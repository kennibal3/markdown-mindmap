import { useEffect, useRef, useState } from 'react'
import {
  AppHeader,
  type ExportFormat,
} from './components/AppHeader/AppHeader'
import { SmartRefineDialog } from './features/ai/SmartRefineDialog'
import { MarkdownEditor } from './features/editor/MarkdownEditor'
import {
  readMarkdownFile,
  validateMarkdownFile,
} from './features/editor/markdown-file'
import {
  loadWorkspaceDraft,
  saveWorkspaceDraft,
} from './features/editor/draft-storage'
import {
  exportMarkdown,
  exportPdf,
  exportPng,
  exportSvg,
} from './features/export/export-workspace'
import { MindmapPreview } from './features/mindmap/MindmapPreview'
import './App.css'

const INITIAL_MARKDOWN = `# 产品构想

## 核心需求
- 导入 Markdown
- 实时生成脑图

## 智能能力
- 从长文本提炼结构`

type WorkspaceFeedback = {
  kind: 'error' | 'success'
  message: string
}

function getInitialWorkspace() {
  const draft = loadWorkspaceDraft()

  return {
    fileName: draft?.fileName ?? 'draft.md',
    markdown: draft?.markdown ?? INITIAL_MARKDOWN,
    recovered: Boolean(draft),
  }
}

function App() {
  const [initialWorkspace] = useState(getInitialWorkspace)
  const [markdown, setMarkdown] = useState(initialWorkspace.markdown)
  const [fileName, setFileName] = useState(initialWorkspace.fileName)
  const [isSmartRefineOpen, setIsSmartRefineOpen] = useState(false)
  const [feedback, setFeedback] = useState<WorkspaceFeedback | null>(
    initialWorkspace.recovered
      ? { kind: 'success', message: '已恢复本地草稿' }
      : null,
  )
  const previousWorkspace = useRef({ fileName, markdown })
  const mindmapCanvasRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    const previous = previousWorkspace.current
    if (previous.fileName === fileName && previous.markdown === markdown) return

    previousWorkspace.current = { fileName, markdown }
    const saveTimer = window.setTimeout(() => {
      const saved = saveWorkspaceDraft({ fileName, markdown })
      setFeedback(
        saved
          ? { kind: 'success', message: '已自动保存' }
          : {
              kind: 'error',
              message: '无法自动保存，请检查浏览器存储空间',
            },
      )
    }, 300)

    return () => window.clearTimeout(saveTimer)
  }, [fileName, markdown])

  const handleFileSelected = async (file: File) => {
    const validationError = validateMarkdownFile(file)

    if (validationError) {
      setFeedback({ kind: 'error', message: validationError })
      return
    }

    try {
      const content = await readMarkdownFile(file)
      setMarkdown(content)
      setFileName(file.name)
      setFeedback({ kind: 'success', message: `已导入 ${file.name}` })
    } catch {
      setFeedback({ kind: 'error', message: '无法读取该文件，请重试' })
    }
  }

  const handleExport = async (format: ExportFormat) => {
    try {
      let exportedFileName: string

      if (format === 'markdown') {
        exportedFileName = exportMarkdown(markdown, fileName)
      } else {
        const canvas = mindmapCanvasRef.current
        if (!canvas) throw new Error('脑图画布尚未就绪')

        if (format === 'svg') {
          exportedFileName = exportSvg(canvas, fileName)
        } else if (format === 'png') {
          exportedFileName = await exportPng(canvas, fileName)
        } else {
          exportedFileName = await exportPdf(canvas, fileName)
        }
      }

      setFeedback({
        kind: 'success',
        message: `已导出 ${exportedFileName}`,
      })
    } catch (error) {
      console.error('导出失败', error)
      setFeedback({
        kind: 'error',
        message: `导出失败：${
          error instanceof Error ? error.message : '请重试'
        }`,
      })
    }
  }

  return (
    <div className="app-shell">
      <AppHeader
        canExportMindmap={markdown.trim().length > 0}
        onExport={handleExport}
        onFileSelected={handleFileSelected}
        onOpenSmartRefine={() => setIsSmartRefineOpen(true)}
      />

      {isSmartRefineOpen ? (
        <SmartRefineDialog
          onApply={(refinedMarkdown) => {
            setMarkdown(refinedMarkdown)
            setIsSmartRefineOpen(false)
            setFeedback({ kind: 'success', message: '已应用豆包提炼结果' })
          }}
          onClose={() => setIsSmartRefineOpen(false)}
        />
      ) : null}

      <main className="workbench" aria-label="Markdown 脑图工作区">
        <MarkdownEditor
          fileName={fileName}
          onChange={setMarkdown}
          value={markdown}
        />
        <div className="workbench-divider" aria-hidden="true">
          <span />
        </div>
        <MindmapPreview
          markdown={markdown}
          onCanvasChange={(canvas) => {
            mindmapCanvasRef.current = canvas
          }}
        />
      </main>

      <footer className="app-footer">
        <p>内容仅保存在当前设备</p>
        {feedback ? (
          <p
            className={`footer-feedback footer-feedback--${feedback.kind}`}
            role={feedback.kind === 'error' ? 'alert' : 'status'}
          >
            <span className="status-dot" aria-hidden="true" />
            {feedback.message}
          </p>
        ) : (
          <p>
            <span className="status-dot" aria-hidden="true" />
            工作区已就绪
          </p>
        )}
      </footer>
    </div>
  )
}

export default App
