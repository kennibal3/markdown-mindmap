# API

`/api/refine` 在服务端调用豆包，将普通文本提炼为 Markdown。

部署时配置以下环境变量：

- `ARK_API_KEY`：火山方舟 API Key，不得使用 `VITE_` 前缀。
- `ARK_MODEL_ID`：可选，默认 `doubao-seed-2-1-pro-260628`。

真实密钥不要写入源码、提交记录或前端环境变量。

## Vercel 部署

1. 在 Vercel 项目的 Environment Variables 中新增 `ARK_API_KEY`。
2. 如需覆盖默认模型，再新增 `ARK_MODEL_ID`。
3. 为 Production、Preview 或 Development 选择需要生效的环境后重新部署。

仓库根目录的 `.env.example` 仅列出变量名，不包含真实密钥。
