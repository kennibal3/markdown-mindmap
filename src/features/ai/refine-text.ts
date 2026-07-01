type RefineResponse = {
  error?: string
  markdown?: string
}

export async function refineText(sourceText: string) {
  const response = await fetch('/api/refine', {
    body: JSON.stringify({ text: sourceText }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const data = (await response.json().catch(() => ({}))) as RefineResponse

  if (!response.ok) {
    throw new Error(data.error || '豆包暂时无法完成提炼，请稍后重试')
  }

  if (typeof data.markdown !== 'string' || data.markdown.trim().length === 0) {
    throw new Error('豆包没有返回有效的 Markdown')
  }

  return data.markdown.trim()
}
