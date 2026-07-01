const MAX_MARKDOWN_FILE_SIZE = 5 * 1024 * 1024

export function validateMarkdownFile(file: File): string | null {
  const fileName = file.name.toLowerCase()

  if (!fileName.endsWith('.md') && !fileName.endsWith('.markdown')) {
    return '请选择 .md 或 .markdown 文件'
  }

  if (file.size > MAX_MARKDOWN_FILE_SIZE) {
    return 'Markdown 文件不能超过 5 MB'
  }

  return null
}

export function readMarkdownFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(file, 'UTF-8')
  })
}
