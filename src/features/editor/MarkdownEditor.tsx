type MarkdownEditorProps = {
  fileName: string
  onChange: (value: string) => void
  value: string
}

export function MarkdownEditor({ fileName, onChange, value }: MarkdownEditorProps) {
  const lineCount = value.length === 0 ? 1 : value.split(/\r\n|\r|\n/).length
  const characterCount = Array.from(value).length

  return (
    <section className="workspace-panel editor-panel" aria-labelledby="editor-title">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">SOURCE</p>
          <h2 id="editor-title">Markdown 源文档</h2>
        </div>
        <span className="panel-badge" title={fileName}>
          {fileName}
        </span>
      </div>

      <div className="editor-surface">
        <textarea
          aria-label="Markdown 编辑器"
          className="markdown-editor"
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="# 从这里开始写下你的主题"
          spellCheck={false}
          value={value}
        />
      </div>

      <div className="panel-status" aria-label="编辑器状态">
        <span>UTF-8</span>
        <span>Markdown</span>
        <span>{lineCount} 行</span>
        <span>{characterCount} 字符</span>
      </div>
    </section>
  )
}
