const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const EXPORT_PADDING = 48
const PNG_TARGET_SCALE = 4
const PNG_MAX_DIMENSION = 8_192
const PNG_MAX_PIXELS = 32_000_000

type ExportFrame = {
  height: number
  width: number
  x: number
  y: number
}

type PreparedSvg = ExportFrame & {
  element: SVGSVGElement
  source: string
}

function exportBaseName(fileName: string) {
  const withoutExtension = fileName.replace(/\.(?:md|markdown)$/i, '')
  const safeName = withoutExtension
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()

  return safeName || 'mindmap'
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.download = fileName
  anchor.href = url
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('无法生成 PNG 文件'))
    }, 'image/png')
  })
}

function getRootContent(svg: SVGSVGElement) {
  return Array.from(svg.children).find(
    (element): element is SVGGraphicsElement =>
      element.tagName.toLowerCase() === 'g',
  )
}

function getExportFrame(svg: SVGSVGElement): ExportFrame {
  const content = getRootContent(svg)

  if (content && typeof content.getBBox === 'function') {
    try {
      const bounds = content.getBBox()
      if (
        Number.isFinite(bounds.x) &&
        Number.isFinite(bounds.y) &&
        Number.isFinite(bounds.width) &&
        Number.isFinite(bounds.height) &&
        bounds.width > 0 &&
        bounds.height > 0
      ) {
        return {
          height: Math.ceil(bounds.height + EXPORT_PADDING * 2),
          width: Math.ceil(bounds.width + EXPORT_PADDING * 2),
          x: Math.floor(bounds.x - EXPORT_PADDING),
          y: Math.floor(bounds.y - EXPORT_PADDING),
        }
      }
    } catch {
      // Detached or temporarily hidden SVG nodes may not expose a usable bbox.
    }
  }

  const bounds = svg.getBoundingClientRect()
  return {
    height: Math.max(1, Math.round(bounds.height || 720)),
    width: Math.max(1, Math.round(bounds.width || 1200)),
    x: 0,
    y: 0,
  }
}

function prepareMindmapSvg(svg: SVGSVGElement): PreparedSvg {
  const frame = getExportFrame(svg)
  const clone = svg.cloneNode(true) as SVGSVGElement
  const cloneContent = getRootContent(clone)
  cloneContent?.removeAttribute('transform')

  clone.setAttributeNS(
    'http://www.w3.org/2000/xmlns/',
    'xmlns:xhtml',
    'http://www.w3.org/1999/xhtml',
  )
  clone.setAttribute('width', String(frame.width))
  clone.setAttribute('height', String(frame.height))
  clone.setAttribute(
    'viewBox',
    `${frame.x} ${frame.y} ${frame.width} ${frame.height}`,
  )
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  const background = document.createElementNS(SVG_NAMESPACE, 'rect')
  background.setAttribute('x', String(frame.x))
  background.setAttribute('y', String(frame.y))
  background.setAttribute('width', String(frame.width))
  background.setAttribute('height', String(frame.height))
  background.setAttribute('fill', '#fbfaf7')

  const style = document.createElementNS(SVG_NAMESPACE, 'style')
  style.textContent = `
    .markmap-link { fill: none; }
    .markmap-node { color: #292722; font: 300 16px ui-sans-serif, system-ui, sans-serif; }
    .markmap-node foreignObject { overflow: visible; }
    .markmap-node div { line-height: 1.35; white-space: nowrap; }
  `
  clone.prepend(style)
  clone.prepend(background)

  return {
    ...frame,
    element: clone,
    source: new XMLSerializer().serializeToString(clone),
  }
}

function getPngScale(width: number, height: number) {
  return Math.min(
    PNG_TARGET_SCALE,
    PNG_MAX_DIMENSION / width,
    PNG_MAX_DIMENSION / height,
    Math.sqrt(PNG_MAX_PIXELS / (width * height)),
  )
}

async function renderSvgCanvas(
  element: SVGSVGElement,
  width: number,
  height: number,
) {
  const source = new XMLSerializer().serializeToString(element)
  const sourceUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('无法渲染脑图'))
    image.src = sourceUrl
  })

  const canvas = document.createElement('canvas')
  const scale = getPngScale(width, height)
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持图像导出')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function renderMindmapCanvas(svg: SVGSVGElement) {
  const prepared = prepareMindmapSvg(svg)
  return renderSvgCanvas(prepared.element, prepared.width, prepared.height)
}

function createPdfLayers(preparedSvg: PreparedSvg) {
  const vector = preparedSvg.element.cloneNode(true) as SVGSVGElement
  vector.querySelectorAll('foreignObject').forEach((node) => node.remove())
  vector.querySelectorAll('style').forEach((node) => node.remove())
  vector
    .querySelectorAll<SVGPathElement>('path.markmap-link')
    .forEach((path) => path.setAttribute('fill', 'none'))

  const text = preparedSvg.element.cloneNode(true) as SVGSVGElement
  text
    .querySelectorAll('path, circle, rect, g.markmap-highlight')
    .forEach((node) => node.remove())

  return { text, vector }
}

export function exportMarkdown(markdown: string, fileName: string) {
  const exportName = `${exportBaseName(fileName)}.md`
  downloadBlob(
    new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
    exportName,
  )
  return exportName
}

export function serializeMindmapSvg(svg: SVGSVGElement) {
  return prepareMindmapSvg(svg).source
}

export function exportSvg(svg: SVGSVGElement, fileName: string) {
  const exportName = `${exportBaseName(fileName)}.svg`
  const source = serializeMindmapSvg(svg)
  downloadBlob(
    new Blob([source], { type: 'image/svg+xml;charset=utf-8' }),
    exportName,
  )
  return exportName
}

export async function exportPng(svg: SVGSVGElement, fileName: string) {
  const exportName = `${exportBaseName(fileName)}.png`
  const canvas = await renderMindmapCanvas(svg)
  downloadBlob(await canvasToBlob(canvas), exportName)
  return exportName
}

export async function exportPdf(svg: SVGSVGElement, fileName: string) {
  const exportName = `${exportBaseName(fileName)}.pdf`
  const preparedSvg = prepareMindmapSvg(svg)
  const layers = createPdfLayers(preparedSvg)
  const textCanvas = await renderSvgCanvas(
    layers.text,
    preparedSvg.width,
    preparedSvg.height,
  )
  const { jsPDF } = await import('jspdf')
  await import('svg2pdf.js')
  const pdf = new jsPDF({
    compress: true,
    format: 'a4',
    orientation: 'landscape',
    unit: 'mm',
  })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 10
  const availableWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - margin * 2
  const scale = Math.min(
    availableWidth / preparedSvg.width,
    availableHeight / preparedSvg.height,
  )
  const imageWidth = preparedSvg.width * scale
  const imageHeight = preparedSvg.height * scale

  const imageX = (pageWidth - imageWidth) / 2
  const imageY = (pageHeight - imageHeight) / 2

  await pdf.svg(layers.vector, {
    height: imageHeight,
    width: imageWidth,
    x: imageX,
    y: imageY,
  })
  pdf.addImage(
    textCanvas.toDataURL('image/png'),
    'PNG',
    imageX,
    imageY,
    imageWidth,
    imageHeight,
    undefined,
    'SLOW',
  )
  pdf.save(exportName)
  return exportName
}
