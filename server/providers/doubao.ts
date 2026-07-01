import type { AiProvider, RefineResult } from './types.js'

const DOUBAO_API_URL =
  'https://ark.cn-beijing.volces.com/api/v3/chat/completions'

const LONG_TEXT_THRESHOLD = 2_500
const LONG_TEXT_CHUNK_SIZE = 2_000

const DIRECT_REFINEMENT_PROMPT = `你是一名信息架构师。请将用户提供的普通文本提炼为适合思维导图的 Markdown。
要求：
1. 只输出 Markdown，不要代码围栏、解释或前后缀。
2. 先压缩内容：合并重复信息、删除格式噪音，保留关键事实、状态、结论、风险、行动项、责任人、时间和必要数字。
3. 再分类组织：使用一个一级标题作为中心主题，使用二级、三级标题和无序列表表达层级。
4. 不添加原文没有的事实，不遗漏尚未完成、存在风险或需要跟进的事项。
5. 节点文字简洁明确，避免长段落。`

const CHUNK_COMPRESSION_PROMPT = `你是一名长文本压缩器。请压缩用户提供的一个文本分段，为后续统一分类做准备。
要求：
1. 只输出结构化摘要，不要解释、代码围栏或总标题。
2. 合并重复内容并删除表格符号、装饰符号等格式噪音。
3. 保留主题、关键事实、完成状态、结论、数字、责任人、时间、风险、待办和下一步行动。
4. 不添加原文没有的事实，不因为压缩而删除未完成或异常事项。
5. 控制在约 800 个中文字符以内，使用简短条目。`

const SUMMARY_SYNTHESIS_PROMPT = `你是一名信息架构师。输入内容是同一篇长文本的分段摘要汇总，请去重、归类并生成适合思维导图的 Markdown。
要求：
1. 只输出 Markdown，不要代码围栏、解释或前后缀。
2. 使用一个一级标题作为中心主题。
3. 使用二级、三级标题和无序列表表达层级，优先按主题、状态、风险和行动项分类。
4. 合并同义内容，但保留关键事实、状态、结论、数字、责任人、时间、风险和待办。
5. 不添加摘要中不存在的事实，节点文字保持简洁。`

type DoubaoResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  model?: string
}

type DoubaoProviderOptions = {
  apiKey: string
  model: string
}

type CompletionOptions = {
  maxTokens: number
  systemPrompt: string
  timeoutMs: number
  userContent: string
}

type CompletionResult = {
  content: string
  model: string
}

export type DoubaoFailureKind =
  | 'invalid-response'
  | 'network'
  | 'timeout'
  | 'upstream'

type DoubaoProviderErrorDetails = {
  elapsedMs: number
  kind: DoubaoFailureKind
  requestId?: string
  status?: number
  upstreamCode?: string
}

export class DoubaoProviderError extends Error {
  readonly elapsedMs: number
  readonly kind: DoubaoFailureKind
  readonly requestId?: string
  readonly status?: number
  readonly upstreamCode?: string

  constructor(details: DoubaoProviderErrorDetails) {
    super(`Doubao provider failed: ${details.kind}`)
    this.name = 'DoubaoProviderError'
    this.elapsedMs = details.elapsedMs
    this.kind = details.kind
    this.requestId = details.requestId
    this.status = details.status
    this.upstreamCode = details.upstreamCode
  }
}

function normalizeMarkdown(content: string) {
  return content
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/i, '$1')
    .trim()
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

async function readUpstreamErrorCode(response: Response) {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown }
    }
    return typeof body.error?.code === 'string' ? body.error.code : undefined
  } catch {
    return undefined
  }
}

function shouldRetryStatus(status: number) {
  return status === 429 || status >= 500
}

function splitLongText(sourceText: string) {
  const chunks: string[] = []
  let currentChunk = ''

  const pushCurrentChunk = () => {
    const chunk = currentChunk.trim()
    if (chunk) chunks.push(chunk)
    currentChunk = ''
  }

  for (const line of sourceText.split('\n')) {
    if (line.length > LONG_TEXT_CHUNK_SIZE) {
      pushCurrentChunk()
      for (let offset = 0; offset < line.length; offset += LONG_TEXT_CHUNK_SIZE) {
        chunks.push(line.slice(offset, offset + LONG_TEXT_CHUNK_SIZE))
      }
      continue
    }

    const candidate = currentChunk ? `${currentChunk}\n${line}` : line
    if (candidate.length > LONG_TEXT_CHUNK_SIZE) {
      pushCurrentChunk()
      currentChunk = line
    } else {
      currentChunk = candidate
    }
  }

  pushCurrentChunk()
  return chunks
}

export class DoubaoProvider implements AiProvider {
  private readonly options: DoubaoProviderOptions

  constructor(options: DoubaoProviderOptions) {
    this.options = options
  }

  private async complete(options: CompletionOptions): Promise<CompletionResult> {
    const startedAt = Date.now()

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response

      try {
        response = await fetch(DOUBAO_API_URL, {
          body: JSON.stringify({
            max_tokens: options.maxTokens,
            messages: [
              { content: options.systemPrompt, role: 'system' },
              { content: options.userContent, role: 'user' },
            ],
            model: this.options.model,
            stream: false,
            temperature: 0.2,
            thinking: { type: 'disabled' },
          }),
          headers: {
            Authorization: `Bearer ${this.options.apiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(options.timeoutMs),
        })
      } catch (error) {
        const kind = isTimeoutError(error) ? 'timeout' : 'network'
        if (kind === 'network' && attempt === 0) continue

        throw new DoubaoProviderError({
          elapsedMs: Date.now() - startedAt,
          kind,
        })
      }

      const requestId =
        response.headers.get('x-tt-logid') ??
        response.headers.get('x-request-id') ??
        undefined

      if (!response.ok) {
        const upstreamCode = await readUpstreamErrorCode(response)
        if (attempt === 0 && shouldRetryStatus(response.status)) continue

        throw new DoubaoProviderError({
          elapsedMs: Date.now() - startedAt,
          kind: 'upstream',
          requestId,
          status: response.status,
          upstreamCode,
        })
      }

      let data: DoubaoResponse
      try {
        data = (await response.json()) as DoubaoResponse
      } catch {
        throw new DoubaoProviderError({
          elapsedMs: Date.now() - startedAt,
          kind: 'invalid-response',
          requestId,
        })
      }

      const content = normalizeMarkdown(
        data.choices?.[0]?.message?.content ?? '',
      )
      if (!content) {
        throw new DoubaoProviderError({
          elapsedMs: Date.now() - startedAt,
          kind: 'invalid-response',
          requestId,
        })
      }

      return {
        content,
        model: data.model || this.options.model,
      }
    }

    throw new DoubaoProviderError({
      elapsedMs: Date.now() - startedAt,
      kind: 'network',
    })
  }

  async refine(sourceText: string): Promise<RefineResult> {
    if (sourceText.length <= LONG_TEXT_THRESHOLD) {
      const result = await this.complete({
        maxTokens: 1_800,
        systemPrompt: DIRECT_REFINEMENT_PROMPT,
        timeoutMs: 60_000,
        userContent: sourceText,
      })

      return {
        markdown: result.content,
        model: result.model,
        provider: 'doubao',
      }
    }

    const chunks = splitLongText(sourceText)
    const summaries = await Promise.all(
      chunks.map(async (chunk, index) => {
        const result = await this.complete({
          maxTokens: 600,
          systemPrompt: CHUNK_COMPRESSION_PROMPT,
          timeoutMs: 45_000,
          userContent: `第 ${index + 1}/${chunks.length} 段：\n${chunk}`,
        })
        return result.content
      }),
    )
    const synthesis = await this.complete({
      maxTokens: 2_000,
      systemPrompt: SUMMARY_SYNTHESIS_PROMPT,
      timeoutMs: 45_000,
      userContent: summaries
        .map((summary, index) => `## 分段摘要 ${index + 1}\n${summary}`)
        .join('\n\n'),
    })

    return {
      markdown: synthesis.content,
      model: synthesis.model,
      provider: 'doubao',
    }
  }
}
