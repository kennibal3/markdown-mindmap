import {
  DoubaoProvider,
  DoubaoProviderError,
} from '../server/providers/doubao.js'

const DEFAULT_MODEL = 'doubao-seed-2-1-pro-260628'
const MAX_SOURCE_LENGTH = 20_000

type RuntimeProcess = {
  env?: Record<string, string | undefined>
}

const runtimeEnvironment =
  (globalThis as typeof globalThis & { process?: RuntimeProcess }).process?.env ??
  {}

function jsonResponse(payload: object, status: number) {
  return Response.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
    status,
  })
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: '请求内容不是有效的 JSON' }, 400)
  }

  const text =
    typeof body === 'object' &&
    body !== null &&
    'text' in body &&
    typeof body.text === 'string'
      ? body.text.trim()
      : ''

  if (text.length === 0 || text.length > MAX_SOURCE_LENGTH) {
    return jsonResponse({ error: '文本长度应为 1 至 20,000 个字符' }, 400)
  }

  const apiKey = runtimeEnvironment.ARK_API_KEY
  if (!apiKey) {
    return jsonResponse({ error: '智能提炼服务尚未配置' }, 503)
  }

  const provider = new DoubaoProvider({
    apiKey,
    model: runtimeEnvironment.ARK_MODEL_ID || DEFAULT_MODEL,
  })

  try {
    return jsonResponse(await provider.refine(text), 200)
  } catch (error) {
    if (error instanceof DoubaoProviderError) {
      console.error(
        'ai_refine_failed',
        JSON.stringify({
          elapsedMs: error.elapsedMs,
          inputChars: text.length,
          kind: error.kind,
          requestId: error.requestId,
          status: error.status,
          upstreamCode: error.upstreamCode,
        }),
      )

      if (error.kind === 'timeout') {
        return jsonResponse(
          { error: '豆包处理超时，请缩短文本后重试' },
          504,
        )
      }

      if (error.status === 429) {
        return jsonResponse(
          { error: '豆包请求过于频繁，请稍后重试' },
          429,
        )
      }
    } else {
      console.error(
        'ai_refine_failed',
        JSON.stringify({ inputChars: text.length, kind: 'unknown' }),
      )
    }

    return jsonResponse(
      { error: '豆包暂时无法完成提炼，请稍后重试' },
      502,
    )
  }
}
