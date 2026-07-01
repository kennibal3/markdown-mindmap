import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../api/refine.js'

const API_URL = 'http://localhost/api/refine'

function createRequest(body: unknown) {
  return new Request(API_URL, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
}

afterEach(() => {
  delete process.env.ARK_API_KEY
  delete process.env.ARK_MODEL_ID
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('POST /api/refine', () => {
  it('缺少豆包密钥时返回明确的未配置状态', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createRequest({ text: '整理这段文字' }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: '智能提炼服务尚未配置',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('校验待提炼文本长度', async () => {
    process.env.ARK_API_KEY = 'test-key'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const emptyResponse = await POST(createRequest({ text: '   ' }))
    const longResponse = await POST(createRequest({ text: '字'.repeat(20_001) }))

    expect(emptyResponse.status).toBe(400)
    expect(longResponse.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('通过豆包 Provider 返回清理后的 Markdown', async () => {
    process.env.ARK_API_KEY = 'test-key'
    process.env.ARK_MODEL_ID = 'doubao-test-model'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '```markdown\n# 项目复盘\n## 成果\n- 完成首版\n```',
              },
            },
          ],
          model: 'doubao-test-model',
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createRequest({ text: '整理项目复盘' }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      markdown: '# 项目复盘\n## 成果\n- 完成首版',
      model: 'doubao-test-model',
      provider: 'doubao',
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
        method: 'POST',
      }),
    )
    const requestBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(requestBody).toMatchObject({
      model: 'doubao-test-model',
      stream: false,
      thinking: { type: 'disabled' },
    })
  })

  it('豆包限流时返回可重试状态并隐藏上游错误细节', async () => {
    process.env.ARK_API_KEY = 'test-key'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'RateLimitExceeded', message: 'sensitive detail' },
          }),
          {
            headers: { 'x-tt-logid': 'upstream-request-id' },
            status: 429,
          },
        ),
      ),
    )

    const response = await POST(createRequest({ text: '整理项目复盘' }))

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: '豆包请求过于频繁，请稍后重试',
    })
  })

  it('豆包超时时返回 504 且诊断日志不包含原文或密钥', async () => {
    process.env.ARK_API_KEY = 'test-key'
    const sourceText = '不能出现在日志中的用户原文'
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    )

    const response = await POST(createRequest({ text: sourceText }))
    const serializedLogs = JSON.stringify(errorLog.mock.calls)

    expect(response.status).toBe(504)
    await expect(response.json()).resolves.toEqual({
      error: '豆包处理超时，请缩短文本后重试',
    })
    expect(serializedLogs).toContain('timeout')
    expect(serializedLogs).not.toContain(sourceText)
    expect(serializedLogs).not.toContain('test-key')
  })

  it('3,091 字文本先分段压缩，再汇总为最终 Markdown', async () => {
    process.env.ARK_API_KEY = 'test-key'
    const sourceText = '培训实施进展与后续行动项。'.repeat(300).slice(0, 3_091)
    const requestBodies: Array<{
      messages: Array<{ content: string; role: string }>
    }> = []
    const fetchMock = vi.fn().mockImplementation(
      async (_url: string, request: RequestInit) => {
        const body = JSON.parse(request.body as string)
        requestBodies.push(body)
        const isCompression = body.messages[0].content.includes('长文本压缩')

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: isCompression
                    ? `分段摘要 ${requestBodies.length}`
                    : '# 项目进展\n## 已完成\n- 分段压缩与汇总',
                },
              },
            ],
            model: 'doubao-test-model',
          }),
          { status: 200 },
        )
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createRequest({ text: sourceText }))
    const compressionRequests = requestBodies.filter((body) =>
      body.messages[0].content.includes('长文本压缩'),
    )
    const synthesisRequests = requestBodies.filter((body) =>
      body.messages[0].content.includes('分段摘要汇总'),
    )

    expect(response.status).toBe(200)
    expect(sourceText).toHaveLength(3_091)
    await expect(response.json()).resolves.toMatchObject({
      markdown: '# 项目进展\n## 已完成\n- 分段压缩与汇总',
    })
    expect(compressionRequests.length).toBeGreaterThan(1)
    expect(synthesisRequests).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(compressionRequests.length + 1)
    expect(synthesisRequests[0].messages[1].content).toContain('分段摘要')
  })

  it('豆包临时服务异常时自动重试一次', async () => {
    process.env.ARK_API_KEY = 'test-key'
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 'InternalServiceError' } }),
          { status: 500 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '# 重试成功' } }],
            model: 'doubao-test-model',
          }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(createRequest({ text: '整理项目复盘' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      markdown: '# 重试成功',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(errorLog).not.toHaveBeenCalled()
  })
})
