import { useEffect, useMemo, useRef } from 'react'
import { Transformer } from 'markmap-lib/no-plugins'
import type { Markmap } from 'markmap-view'

type MindmapPreviewProps = {
  markdown: string
  onCanvasChange?: (canvas: SVGSVGElement | null) => void
}

type MindmapNode = ReturnType<Transformer['transform']>['root']

const transformer = new Transformer()
const palette = ['#c95138', '#536b59', '#8b6b45', '#2d7185', '#87637f']

function nodeContentToText(content: string) {
  const parsed = new DOMParser().parseFromString(content, 'text/html')
  return parsed.body.textContent?.trim() ?? ''
}

function collectNodeLabels(node: MindmapNode): string[] {
  const ownLabel = nodeContentToText(node.content)
  const childLabels = node.children.flatMap(collectNodeLabels)
  return ownLabel ? [ownLabel, ...childLabels] : childLabels
}

export function MindmapPreview({
  markdown,
  onCanvasChange,
}: MindmapPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const markmapRef = useRef<Markmap | null>(null)
  const hasContent = markdown.trim().length > 0
  const root = useMemo(
    () => (hasContent ? transformer.transform(markdown).root : null),
    [hasContent, markdown],
  )
  const nodeLabels = useMemo(() => (root ? collectNodeLabels(root) : []), [root])

  useEffect(() => {
    if (!root) {
      markmapRef.current?.destroy()
      markmapRef.current = null
      return
    }

    if (!svgRef.current || typeof ResizeObserver === 'undefined') return

    let cancelled = false

    async function renderMindmap() {
      const { Markmap } = await import('markmap-view')
      if (cancelled || !svgRef.current) return

      if (!markmapRef.current) {
        markmapRef.current = Markmap.create(
          svgRef.current,
          {
            autoFit: true,
            color: (node) => palette[node.state.depth % palette.length],
            duration: 180,
            fitRatio: 0.88,
            lineWidth: (node) => (node.state.depth === 1 ? 2 : 1.4),
            maxInitialScale: 1.15,
            maxWidth: 240,
            nodeMinHeight: 20,
            paddingX: 10,
            pan: true,
            scrollForPan: false,
            spacingHorizontal: 90,
            spacingVertical: 12,
            toggleRecursively: false,
            zoom: true,
          },
          root,
        )
        return
      }

      await markmapRef.current.setData(root)
    }

    void renderMindmap()

    return () => {
      cancelled = true
    }
  }, [root])

  useEffect(
    () => () => {
      markmapRef.current?.destroy()
      markmapRef.current = null
    },
    [],
  )

  return (
    <section className="workspace-panel mindmap-panel" aria-labelledby="mindmap-title">
      <div className="panel-header mindmap-header">
        <div>
          <p className="panel-eyebrow">CANVAS</p>
          <h2 id="mindmap-title">思维导图预览</h2>
        </div>

        <div className="mindmap-actions">
          <span className="panel-badge panel-badge--live">
            <span aria-hidden="true" />
            实时预览
          </span>
          <div className="mindmap-controls" aria-label="脑图视图控制">
            <button
              aria-label="缩小脑图"
              className="map-control"
              disabled={!hasContent}
              onClick={() => void markmapRef.current?.rescale(0.8)}
              title="缩小"
              type="button"
            >
              −
            </button>
            <button
              aria-label="放大脑图"
              className="map-control"
              disabled={!hasContent}
              onClick={() => void markmapRef.current?.rescale(1.25)}
              title="放大"
              type="button"
            >
              +
            </button>
            <button
              aria-label="适应画布"
              className="map-control map-control--fit"
              disabled={!hasContent}
              onClick={() => void markmapRef.current?.fit()}
              title="适应画布"
              type="button"
            >
              适应
            </button>
          </div>
        </div>
      </div>

      <div className="mindmap-stage">
        {hasContent ? (
          <>
            <svg
              ref={(canvas) => {
                svgRef.current = canvas
                onCanvasChange?.(canvas)
              }}
              aria-hidden="true"
              className="markmap-canvas"
            />
            <div aria-live="polite" className="sr-only">
              <p>脑图已根据 Markdown 更新</p>
              <ul aria-label="脑图节点列表">
                {nodeLabels.map((label, index) => (
                  <li key={`${index}-${label}`}>{label}</li>
                ))}
              </ul>
            </div>
            <p className="canvas-guide">滚轮缩放 · 拖动画布 · 点击节点折叠</p>
          </>
        ) : (
          <div className="mindmap-empty" role="status">
            <span aria-hidden="true">#</span>
            <p>输入 Markdown 后将在这里生成脑图</p>
          </div>
        )}
      </div>
    </section>
  )
}
