import { useRef, useState } from 'react'
import { BrandMark, DownloadIcon, FileIcon, SparkIcon } from '../Icons/Icons'

export type ExportFormat = 'markdown' | 'pdf' | 'png' | 'svg'

type AppHeaderProps = {
  canExportMindmap: boolean
  onExport: (format: ExportFormat) => void
  onFileSelected: (file: File) => void
  onOpenSmartRefine: () => void
}

const exportOptions: Array<{ format: ExportFormat; label: string }> = [
  { format: 'markdown', label: '导出 Markdown' },
  { format: 'svg', label: '导出 SVG' },
  { format: 'png', label: '导出 PNG' },
  { format: 'pdf', label: '导出 PDF' },
]

export function AppHeader({
  canExportMindmap,
  onExport,
  onFileSelected,
  onOpenSmartRefine,
}: AppHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportButtonRef = useRef<HTMLButtonElement>(null)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)

  return (
    <header className="app-header">
      <div className="brand-lockup">
        <BrandMark />
        <div>
          <p className="brand-kicker">MARKDOWN · MINDMAP</p>
          <h1>Markdown 脑图工作台</h1>
        </div>
      </div>

      <nav className="header-actions" aria-label="主要操作">
        <button
          className="action-button"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <FileIcon />
          导入 Markdown
        </button>
        <input
          ref={fileInputRef}
          accept=".md,.markdown,text/markdown"
          aria-label="选择 Markdown 文件"
          className="file-input"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) onFileSelected(file)
            event.currentTarget.value = ''
          }}
          type="file"
        />
        <button
          className="action-button action-button--accent"
          onClick={onOpenSmartRefine}
          type="button"
        >
          <SparkIcon />
          智能提炼
        </button>
        <div
          className="export-control"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            setIsExportMenuOpen(false)
            exportButtonRef.current?.focus()
          }}
        >
          <button
            ref={exportButtonRef}
            aria-controls="export-menu"
            aria-expanded={isExportMenuOpen}
            className="action-button"
            onClick={() => setIsExportMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <DownloadIcon />
            导出
          </button>
          {isExportMenuOpen ? (
            <div
              aria-label="导出格式"
              className="export-menu"
              id="export-menu"
              role="menu"
            >
              {exportOptions.map((option) => (
                <button
                  className="export-menu-item"
                  disabled={option.format !== 'markdown' && !canExportMindmap}
                  key={option.format}
                  onClick={() => {
                    setIsExportMenuOpen(false)
                    onExport(option.format)
                  }}
                  role="menuitem"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
    </header>
  )
}
