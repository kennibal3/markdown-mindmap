import { useState } from 'react'
import { refineText } from './refine-text'

type SmartRefineDialogProps = {
  onApply: (markdown: string) => void
  onClose: () => void
}

export function SmartRefineDialog({
  onApply,
  onClose,
}: SmartRefineDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [previewMarkdown, setPreviewMarkdown] = useState<string | null>(null)
  const [sourceText, setSourceText] = useState('')

  const handleSubmit = async () => {
    setError(null)
    setIsLoading(true)

    try {
      setPreviewMarkdown(await refineText(sourceText.trim()))
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '豆包暂时无法完成提炼，请稍后重试',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="ai-dialog-backdrop">
      <section
        aria-labelledby="ai-dialog-title"
        aria-modal="true"
        className="ai-dialog"
        role="dialog"
      >
        <div className="ai-dialog-header">
          <div>
            <p className="panel-eyebrow">DOUBAO · STRUCTURE</p>
            <h2 id="ai-dialog-title">智能提炼为 Markdown</h2>
          </div>
          <button
            aria-label="关闭智能提炼"
            className="ai-dialog-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form
          className="ai-dialog-form"
          aria-busy={isLoading}
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          {previewMarkdown ? (
            <>
              <label className="ai-field-label" htmlFor="ai-markdown-preview">
                Markdown 预览
              </label>
              <textarea
                className="ai-markdown-preview"
                id="ai-markdown-preview"
                readOnly
                value={previewMarkdown}
              />
              <div className="ai-field-meta">
                <span>确认后才会替换当前编辑器内容</span>
                <span>豆包生成</span>
              </div>
            </>
          ) : (
            <>
              <label className="ai-field-label" htmlFor="ai-source-text">
                待提炼文本
              </label>
              <textarea
                autoFocus
                disabled={isLoading}
                id="ai-source-text"
                maxLength={20_000}
                onChange={(event) => setSourceText(event.currentTarget.value)}
                placeholder="粘贴会议记录、文章、方案或零散想法……"
                value={sourceText}
              />
              <div className="ai-field-meta">
                <span>文本将发送至豆包进行处理</span>
                <span>{sourceText.length.toLocaleString('zh-CN')} / 20,000</span>
              </div>
            </>
          )}

          {error ? (
            <p className="ai-dialog-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="ai-dialog-actions">
            {previewMarkdown ? (
              <>
                <button
                  className="dialog-button"
                  onClick={() => setPreviewMarkdown(null)}
                  type="button"
                >
                  重新编辑
                </button>
                <button
                  className="dialog-button dialog-button--primary"
                  onClick={() => onApply(previewMarkdown)}
                  type="button"
                >
                  应用到编辑器
                </button>
              </>
            ) : (
              <>
                <button
                  className="dialog-button"
                  disabled={isLoading}
                  onClick={onClose}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="dialog-button dialog-button--primary"
                  disabled={isLoading || sourceText.trim().length === 0}
                  type="submit"
                >
            {isLoading ? '正在提炼…' : error ? '重试提炼' : '开始提炼'}
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}
