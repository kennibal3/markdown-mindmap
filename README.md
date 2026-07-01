# Markdown 脑图工作台

一个以 Markdown 为唯一数据源的轻量思维导图 Web 工具。

当前已完成响应式双栏工作台、Markdown 编辑与文件导入、Markmap 实时脑图预览、多格式本地导出，以及豆包智能提炼。

## 已实现

- 直接编辑和粘贴 Markdown
- 导入 `.md`、`.markdown` 文件
- 文件格式与 5 MB 大小限制
- 实时行数和字符数统计
- 导入成功及错误反馈
- Markdown 修改后实时生成思维导图
- 脑图缩放、拖动、节点折叠和一键适应画布
- 空文档提示与脑图节点无障碍文本
- 编辑后自动保存到当前浏览器，并在下次打开时恢复
- 本地存储失败提示与损坏草稿自动回退
- 导出 Markdown 原文和独立 SVG 脑图
- 导出 2× 高清 PNG
- 一键导出 A4 横向单页 PDF
- 普通文本经豆包提炼为 Markdown，预览确认后再应用
- AI 密钥仅由服务端读取，支持通过环境变量切换豆包模型
- 桌面与手机响应式布局

## 本地开发

```bash
npm install
npm run dev
```

仅使用本地编辑、脑图和导出时无需配置密钥。使用智能提炼前，请参考 [api/README.md](api/README.md) 配置服务端环境变量；Vite 本地开发服务器本身不运行 Vercel Function。

## 质量检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 目录说明

- `src/components`：通用界面组件
- `src/features/editor`：Markdown 编辑、统计和文件导入
- `src/features/export`：Markdown、SVG、PNG 和 PDF 导出
- `src/features/mindmap`：思维导图能力
- `src/test`：测试环境配置
- `api`：Vercel AI 接口与可扩展 Provider
- `docs`：产品设计与决策记录

详细设计见 [docs/design.md](docs/design.md)。

## 当前边界

- 首版脑图渲染覆盖标题、列表等基础 Markdown 结构。
- 数学公式、代码高亮、流式输出和多模型切换将在后续阶段实现。
- AI 提炼当前仅接入豆包，输入内容会在用户主动提交后发送至火山方舟。
- 首版 PDF 固定为 A4 横向单页，超大脑图会整体缩小。
