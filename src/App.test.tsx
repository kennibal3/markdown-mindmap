import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import { serializeMindmapSvg } from './features/export/export-workspace'

const markmapMocks = vi.hoisted(() => ({
  create: vi.fn(() => ({
    destroy: vi.fn(),
    fit: vi.fn(),
    rescale: vi.fn(),
    setData: vi.fn(() => Promise.resolve()),
  })),
}))

const pdfMocks = vi.hoisted(() => ({
  addImage: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  svg: vi.fn((_element: SVGSVGElement) => Promise.resolve()),
}))

vi.mock('markmap-view', () => ({
  Markmap: { create: markmapMocks.create },
}))

vi.mock('jspdf', () => ({
  jsPDF: class JsPdfMock {
    internal = {
      pageSize: {
        getHeight: () => 210,
        getWidth: () => 297,
      },
    }

    constructor() {
      pdfMocks.create()
    }

    addImage = pdfMocks.addImage
    save = pdfMocks.save
    svg = pdfMocks.svg
  },
}))

vi.mock('svg2pdf.js', () => ({}))

function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
}

function captureDownload() {
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:export-test')
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  })
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)

  return { click, createObjectURL, revokeObjectURL }
}

function mockCanvasRendering(options: { imageFails?: boolean } = {}) {
  const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image')
  const getContextDescriptor = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'getContext',
  )
  const toBlobDescriptor = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'toBlob',
  )
  const toDataUrlDescriptor = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'toDataURL',
  )
  const drawImage = vi.fn()
  let imageSource = ''
  let canvasSize = { height: 0, width: 0 }

  class InstantImage {
    onerror: (() => void) | null = null
    onload: (() => void) | null = null

    set src(value: string) {
      imageSource = value
      queueMicrotask(() => {
        if (options.imageFails) this.onerror?.()
        else this.onload?.()
      })
    }
  }

  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: InstantImage,
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => ({
      drawImage,
      fillRect: vi.fn(),
      fillStyle: '',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      setTransform: vi.fn(),
    })),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: vi.fn(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      canvasSize = { height: this.height, width: this.width }
      callback(new Blob(['png'], { type: 'image/png' }))
    }),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: vi.fn(() => 'data:image/png;base64,cG5n'),
  })

  return {
    drawImage,
    getImageSource: () => imageSource,
    getCanvasSize: () => canvasSize,
    restore() {
      Object.defineProperty(globalThis, 'Image', imageDescriptor!)
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        'getContext',
        getContextDescriptor!,
      )
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        'toBlob',
        toBlobDescriptor!,
      )
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        'toDataURL',
        toDataUrlDescriptor!,
      )
    },
  }
}

describe('应用工作台', () => {
  beforeEach(() => {
    window.localStorage.clear()
    pdfMocks.addImage.mockClear()
    pdfMocks.create.mockClear()
    pdfMocks.save.mockClear()
    pdfMocks.svg.mockClear()
  })

  it('展示 Markdown 编辑与思维导图预览的基础工作区', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Markdown 脑图工作台' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Markdown 源文档' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '思维导图预览' }),
    ).toBeInTheDocument()
    expect(screen.getByText('实时预览')).toBeInTheDocument()
  })

  it('提供脑图缩放和适应画布控制', () => {
    render(<App />)

    const preview = within(
      screen.getByRole('region', { name: '思维导图预览' }),
    )
    expect(preview.getByRole('button', { name: '缩小脑图' })).toBeEnabled()
    expect(preview.getByRole('button', { name: '放大脑图' })).toBeEnabled()
    expect(preview.getByRole('button', { name: '适应画布' })).toBeEnabled()
  })

  it('开放 Markdown 导入、智能提炼和导出', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: '导入 Markdown' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '智能提炼' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '导出' })).toBeEnabled()
  })

  it('打开智能提炼窗口并说明文本处理方式', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '智能提炼' }))

    const dialog = screen.getByRole('dialog', { name: '智能提炼为 Markdown' })
    expect(within(dialog).getByRole('textbox', { name: '待提炼文本' })).toBeVisible()
    expect(within(dialog).getByText('文本将发送至豆包进行处理')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: '开始提炼' })).toBeDisabled()
  })

  it('预览豆包提炼结果并在确认后应用到编辑器', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          markdown: '# 项目复盘\n## 成果\n- 完成首版',
          model: 'doubao-seed-2-1-pro-260628',
          provider: 'doubao',
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      ),
    )

    try {
      render(<App />)
      const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' })
      const originalMarkdown = (editor as HTMLTextAreaElement).value

      await user.click(screen.getByRole('button', { name: '智能提炼' }))
      await user.type(
        screen.getByRole('textbox', { name: '待提炼文本' }),
        '我们完成了首版，需要整理项目复盘。',
      )
      await user.click(screen.getByRole('button', { name: '开始提炼' }))

      expect(
        await screen.findByRole('textbox', { name: 'Markdown 预览' }),
      ).toHaveValue('# 项目复盘\n## 成果\n- 完成首版')
      expect(editor).toHaveValue(originalMarkdown)

      await user.click(screen.getByRole('button', { name: '应用到编辑器' }))

      expect(editor).toHaveValue('# 项目复盘\n## 成果\n- 完成首版')
      expect(
        screen.queryByRole('dialog', { name: '智能提炼为 Markdown' }),
      ).not.toBeInTheDocument()
      expect(
        within(screen.getByRole('contentinfo')).getByRole('status'),
      ).toHaveTextContent('已应用豆包提炼结果')
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/refine',
        expect.objectContaining({ method: 'POST' }),
      )
    } finally {
      fetchMock.mockRestore()
    }
  })

  it('提炼失败时保留原文并允许重试', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: '智能提炼服务尚未配置' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
      }),
    )

    try {
      render(<App />)
      await user.click(screen.getByRole('button', { name: '智能提炼' }))
      const source = screen.getByRole('textbox', { name: '待提炼文本' })
      await user.type(source, '需要整理的原始内容')
      await user.click(screen.getByRole('button', { name: '开始提炼' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(
        '智能提炼服务尚未配置',
      )
      expect(source).toHaveValue('需要整理的原始内容')
      expect(screen.getByRole('button', { name: '重试提炼' })).toBeEnabled()
    } finally {
      fetchMock.mockRestore()
    }
  })

  it('展开导出菜单并提供四种格式', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '导出' }))

    const formats = within(screen.getByRole('menu', { name: '导出格式' }))
    expect(formats.getByRole('menuitem', { name: '导出 Markdown' })).toBeEnabled()
    expect(formats.getByRole('menuitem', { name: '导出 SVG' })).toBeEnabled()
    expect(formats.getByRole('menuitem', { name: '导出 PNG' })).toBeEnabled()
    expect(formats.getByRole('menuitem', { name: '导出 PDF' })).toBeEnabled()
  })

  it('按 Escape 关闭导出菜单并保留按钮焦点', async () => {
    const user = userEvent.setup()
    render(<App />)

    const exportButton = screen.getByRole('button', { name: '导出' })
    await user.click(exportButton)
    expect(screen.getByRole('menu', { name: '导出格式' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('menu', { name: '导出格式' }),
    ).not.toBeInTheDocument()
    expect(exportButton).toHaveFocus()
  })

  it('空文档时禁用脑图格式导出', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByRole('textbox', { name: 'Markdown 编辑器' }))
    await user.click(screen.getByRole('button', { name: '导出' }))

    const formats = within(screen.getByRole('menu', { name: '导出格式' }))
    expect(formats.getByRole('menuitem', { name: '导出 Markdown' })).toBeEnabled()
    expect(formats.getByRole('menuitem', { name: '导出 SVG' })).toBeDisabled()
    expect(formats.getByRole('menuitem', { name: '导出 PNG' })).toBeDisabled()
    expect(formats.getByRole('menuitem', { name: '导出 PDF' })).toBeDisabled()
  })

  it('将当前原文导出为 Markdown 文件', async () => {
    const user = userEvent.setup()
    const download = captureDownload()

    try {
      render(<App />)
      const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' })
      await user.clear(editor)
      await user.type(editor, '# 待导出的内容')
      await user.click(screen.getByRole('button', { name: '导出' }))
      await user.click(screen.getByRole('menuitem', { name: '导出 Markdown' }))

      expect(download.createObjectURL).toHaveBeenCalledTimes(1)
      const blob = download.createObjectURL.mock.calls[0][0] as Blob
      expect(blob.type).toBe('text/markdown;charset=utf-8')
      expect(await readBlob(blob)).toBe('# 待导出的内容')
      expect(
        (download.click.mock.instances[0] as HTMLAnchorElement).download,
      ).toBe('draft.md')
      expect(
        within(screen.getByRole('contentinfo')).getByRole('status'),
      ).toHaveTextContent('已导出 draft.md')
    } finally {
      download.click.mockRestore()
    }
  })

  it('将当前脑图导出为独立 SVG 文件', async () => {
    const user = userEvent.setup()
    const download = captureDownload()

    try {
      render(<App />)
      await user.click(screen.getByRole('button', { name: '导出' }))
      await user.click(screen.getByRole('menuitem', { name: '导出 SVG' }))

      expect(download.createObjectURL).toHaveBeenCalledTimes(1)
      const blob = download.createObjectURL.mock.calls[0][0] as Blob
      expect(blob.type).toBe('image/svg+xml;charset=utf-8')
      expect(await readBlob(blob)).toContain('<svg')
      expect(
        (download.click.mock.instances[0] as HTMLAnchorElement).download,
      ).toBe('draft.svg')
      expect(
        within(screen.getByRole('contentinfo')).getByRole('status'),
      ).toHaveTextContent('已导出 draft.svg')
    } finally {
      download.click.mockRestore()
    }
  })

  it('将当前脑图导出为 4 倍清晰度 PNG', async () => {
    const user = userEvent.setup()
    const download = captureDownload()
    const canvas = mockCanvasRendering()

    try {
      render(<App />)
      await user.click(screen.getByRole('button', { name: '导出' }))
      await user.click(screen.getByRole('menuitem', { name: '导出 PNG' }))

      await waitFor(() =>
        expect(
          within(screen.getByRole('contentinfo')).getByRole('status'),
        ).toHaveTextContent('已导出 draft.png'),
      )
      const downloadedBlobs = download.createObjectURL.mock.calls.map(
        ([blob]) => blob,
      )
      expect(downloadedBlobs).toContainEqual(
        expect.objectContaining({ type: 'image/png' }),
      )
      expect(
        (download.click.mock.instances[0] as HTMLAnchorElement).download,
      ).toBe('draft.png')
      expect(canvas.drawImage).toHaveBeenCalled()
      expect(canvas.getImageSource()).toMatch(/^data:image\/svg\+xml/)
      expect(canvas.getCanvasSize()).toEqual({ height: 2880, width: 4800 })
    } finally {
      canvas.restore()
      download.click.mockRestore()
    }
  })

  it('将当前脑图以矢量线条和高清文字缩放居中导出为 A4 横向单页 PDF', async () => {
    const user = userEvent.setup()
    const download = captureDownload()
    const canvas = mockCanvasRendering()

    try {
      render(<App />)
      await user.click(screen.getByRole('button', { name: '导出' }))
      await user.click(screen.getByRole('menuitem', { name: '导出 PDF' }))

      await waitFor(() => expect(pdfMocks.save).toHaveBeenCalledWith('draft.pdf'))
      expect(pdfMocks.create).toHaveBeenCalledTimes(1)
      expect(pdfMocks.svg).toHaveBeenCalledTimes(1)
      expect(pdfMocks.addImage).toHaveBeenCalledTimes(1)
      const vectorLayer = pdfMocks.svg.mock.calls[0][0] as SVGSVGElement
      expect(vectorLayer.querySelector('foreignObject')).toBeNull()
      expect(vectorLayer.querySelector('style')).toBeNull()
      expect(
        within(screen.getByRole('contentinfo')).getByRole('status'),
      ).toHaveTextContent('已导出 draft.pdf')
    } finally {
      canvas.restore()
      download.click.mockRestore()
    }
  })

  it('按实际脑图内容裁切导出的 SVG 并移除画布缩放', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const content = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    content.setAttribute('transform', 'translate(120 80) scale(0.5)')
    Object.defineProperty(content, 'getBBox', {
      configurable: true,
      value: () => ({ height: 360, width: 920, x: -320, y: -180 }),
    })
    svg.append(content)

    const source = serializeMindmapSvg(svg)
    const exported = new DOMParser().parseFromString(
      source,
      'image/svg+xml',
    ).documentElement

    expect(exported.getAttribute('viewBox')).toBe('-368 -228 1016 456')
    expect(exported.getAttribute('width')).toBe('1016')
    expect(exported.getAttribute('height')).toBe('456')
    expect(exported.querySelector('svg > g')?.hasAttribute('transform')).toBe(
      false,
    )
  })

  it('脑图图像无法渲染时显示具体导出错误', async () => {
    const user = userEvent.setup()
    const download = captureDownload()
    const canvas = mockCanvasRendering({ imageFails: true })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(<App />)
      await user.click(screen.getByRole('button', { name: '导出' }))
      await user.click(screen.getByRole('menuitem', { name: '导出 PNG' }))

      expect(
        await within(screen.getByRole('contentinfo')).findByRole('alert'),
      ).toHaveTextContent('导出失败：无法渲染脑图')
    } finally {
      consoleError.mockRestore()
      canvas.restore()
      download.click.mockRestore()
    }
  })

  it('允许直接编辑和粘贴 Markdown，并更新文档统计', async () => {
    const user = userEvent.setup()
    render(<App />)

    const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' })
    await user.clear(editor)
    await user.click(editor)
    await user.paste('# 新主题\n- 第一项')

    expect(editor).toHaveValue('# 新主题\n- 第一项')
    expect(screen.getByText('2 行')).toBeInTheDocument()
    expect(screen.getByText('11 字符')).toBeInTheDocument()
  })

  it('Markdown 修改后同步更新脑图内容', async () => {
    const user = userEvent.setup()
    render(<App />)

    const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' })
    await user.clear(editor)
    await user.type(editor, '# 新脑图\n## 分支 A\n- 子节点')

    const preview = screen.getByRole('region', { name: '思维导图预览' })
    expect(within(preview).getByText('新脑图')).toBeInTheDocument()
    expect(within(preview).getByText('分支 A')).toBeInTheDocument()
    expect(within(preview).getByText('子节点')).toBeInTheDocument()
  })

  it('空文档显示脑图空状态', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.clear(screen.getByRole('textbox', { name: 'Markdown 编辑器' }))

    expect(
      within(screen.getByRole('region', { name: '思维导图预览' })).getByRole(
        'status',
      ),
    ).toHaveTextContent('输入 Markdown 后将在这里生成脑图')
  })

  it('文档清空后再次输入时重建脑图画布', async () => {
    const user = userEvent.setup()
    const originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class ResizeObserverStub {
      disconnect() {}
      observe() {}
      unobserve() {}
    }

    try {
      render(<App />)
      await waitFor(() => expect(markmapMocks.create).toHaveBeenCalledTimes(1))

      const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' })
      await user.clear(editor)
      await user.type(editor, '# 重新生成')

      await waitFor(() => expect(markmapMocks.create).toHaveBeenCalledTimes(2))
    } finally {
      globalThis.ResizeObserver = originalResizeObserver
    }
  })

  it('导入 Markdown 文件后替换编辑器内容并显示文件名', async () => {
    const user = userEvent.setup()
    render(<App />)

    const file = new File(['# 导入内容\n- 节点'], 'plan.md', {
      type: 'text/markdown',
    })
    await user.upload(screen.getByLabelText('选择 Markdown 文件'), file)

    expect(screen.getByRole('textbox', { name: 'Markdown 编辑器' })).toHaveValue(
      '# 导入内容\n- 节点',
    )
    expect(screen.getByText('plan.md')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已导入 plan.md')
    expect(
      within(screen.getByRole('region', { name: '思维导图预览' })).getByText(
        '导入内容',
      ),
    ).toBeInTheDocument()
  })

  it('拒绝非 Markdown 文件并保留当前内容', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App />)

    const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' })
    const originalContent = (editor as HTMLTextAreaElement).value
    const file = new File(['普通文本'], 'notes.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText('选择 Markdown 文件'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '请选择 .md 或 .markdown 文件',
    )
    expect(editor).toHaveValue(originalContent)
  })

  it('拒绝超过 5 MB 的 Markdown 文件', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App />)

    const file = new File(['# 过大的文件'], 'large.md', {
      type: 'text/markdown',
    })
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 })
    await user.upload(screen.getByLabelText('选择 Markdown 文件'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Markdown 文件不能超过 5 MB',
    )
  })

  it('重新打开页面时恢复本地草稿', () => {
    window.localStorage.setItem(
      'markdown-mindmap:workspace:v1',
      JSON.stringify({
        fileName: '已恢复.md',
        markdown: '# 恢复的脑图\n- 本地节点',
        version: 1,
      }),
    )

    render(<App />)

    expect(screen.getByRole('textbox', { name: 'Markdown 编辑器' })).toHaveValue(
      '# 恢复的脑图\n- 本地节点',
    )
    expect(screen.getByText('已恢复.md')).toBeInTheDocument()
    expect(
      within(screen.getByRole('contentinfo')).getByRole('status'),
    ).toHaveTextContent('已恢复本地草稿')
  })

  it('忽略并清理损坏的本地草稿', () => {
    window.localStorage.setItem(
      'markdown-mindmap:workspace:v1',
      JSON.stringify({ fileName: 'broken.md', markdown: 42, version: 1 }),
    )

    render(<App />)

    expect(
      (screen.getByRole('textbox', {
        name: 'Markdown 编辑器',
      }) as HTMLTextAreaElement).value,
    ).toContain('# 产品构想')
    expect(
      window.localStorage.getItem('markdown-mindmap:workspace:v1'),
    ).toBeNull()
  })

  it('编辑后自动保存当前 Markdown 和文件名', async () => {
    const user = userEvent.setup()
    render(<App />)

    const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' })
    await user.clear(editor)
    await user.type(editor, '# 自动保存')

    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem('markdown-mindmap:workspace:v1') ?? 'null',
        ),
      ).toMatchObject({
        fileName: 'draft.md',
        markdown: '# 自动保存',
        version: 1,
      })
    })
    expect(
      within(screen.getByRole('contentinfo')).getByRole('status'),
    ).toHaveTextContent('已自动保存')
  })

  it('本地存储不可用时提示错误并保留编辑内容', async () => {
    const user = userEvent.setup()
    const setItem = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      })

    try {
      render(<App />)
      const editor = screen.getByRole('textbox', { name: 'Markdown 编辑器' })
      await user.clear(editor)
      await user.type(editor, '# 仍可编辑')

      expect(
        await within(screen.getByRole('contentinfo')).findByRole('alert'),
      ).toHaveTextContent('无法自动保存，请检查浏览器存储空间')
      expect(editor).toHaveValue('# 仍可编辑')
    } finally {
      setItem.mockRestore()
    }
  })
})
