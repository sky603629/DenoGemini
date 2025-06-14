# Gemini API Proxy

一个基于 Deno 的代理服务，为 Google Gemini 模型提供 OpenAI 兼容的 API 接口。

## ✨ 特性

### 🔄 **完全兼容 OpenAI API**
- 标准的 `/v1/chat/completions` 接口
- 支持流式和非流式响应
- 完整的工具调用 (Function Calling) 支持
- JSON 格式响应支持

### 🧠 **Gemini 模型支持**
- **Gemini 1.5 Flash** - 快速响应，适合日常对话
- **Gemini 1.5 Pro** - 高质量输出，适合复杂任务
- **Gemini 2.5 Flash** - 最新模型，支持思考模式
- **Gemini 2.5 Pro** - 顶级模型，最强推理能力

### 🛠️ **高级功能**
- **思考模式控制** - 支持 `enable_thinking` 参数
- **自然输出优化** - 自动减少过度格式化
- **智能 Token 管理** - 无限制的最大 Token 设置
- **多密钥轮换** - 自动负载均衡和故障转移

### 🚀 **生产就绪**
- 详细的请求/响应日志
- 完善的错误处理和重试机制
- 环境变量配置
- Deno Deploy 部署支持

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd gemini-api-proxy
```

### 2. 配置环境变量
复制 `.env.example` 到 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
# Gemini API 密钥（多个用逗号分隔）
GEMINI_API_KEYS=your-gemini-api-key-1,your-gemini-api-key-2

# 服务端口
PORT=8000

# 访问密码（可选）
ACCESS_PASSWORD=your-access-password

# 日志级别
LOG_LEVEL=INFO

# 请求超时时间（毫秒）
REQUEST_TIMEOUT=30000
```

### 3. 启动服务
```bash
deno task dev
```

服务将在 `http://localhost:8000` 启动。

## 📖 API 使用

### 基础聊天
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-password" \
  -d '{
    "model": "gemini-1.5-flash",
    "messages": [
      {"role": "user", "content": "你好！"}
    ]
  }'
```

### 思考模式（仅 2.5 模型）
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-password" \
  -d '{
    "model": "gemini-2.5-flash-preview-05-20",
    "messages": [
      {"role": "user", "content": "分析这个复杂问题"}
    ],
    "enable_thinking": true
  }'
```

### 工具调用
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-password" \
  -d '{
    "model": "gemini-1.5-flash",
    "messages": [
      {"role": "user", "content": "查询北京天气"}
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_weather",
          "description": "获取天气信息",
          "parameters": {
            "type": "object",
            "properties": {
              "city": {"type": "string", "description": "城市名称"}
            },
            "required": ["city"]
          }
        }
      }
    ],
    "tool_choice": "auto"
  }'
```

### JSON 格式响应
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-password" \
  -d '{
    "model": "gemini-1.5-flash",
    "messages": [
      {"role": "user", "content": "返回用户信息的JSON对象"}
    ],
    "response_format": {"type": "json_object"}
  }'
```

## 🎛️ 支持的参数

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `model` | string | 模型名称 | 必需 |
| `messages` | array | 对话消息 | 必需 |
| `temperature` | number | 随机性控制 (0-2) | 1.0 |
| `top_p` | number | 核采样参数 (0-1) | 1.0 |
| `max_tokens` | number | 最大输出 tokens | 65536/8192 |
| `stream` | boolean | 是否流式响应 | false |
| `stop` | string/array | 停止序列 | null |
| `tools` | array | 工具定义 | null |
| `tool_choice` | string/object | 工具选择策略 | "auto" |
| `response_format` | object | 响应格式 | null |
| `enable_thinking` | boolean | 启用思考模式 (仅2.5) | false |

## 🤖 支持的模型

| 模型名称 | 描述 | 特性 |
|----------|------|------|
| `gemini-1.5-flash` | 快速响应模型 | 高速、低延迟 |
| `gemini-1.5-pro` | 专业级模型 | 高质量输出 |
| `gemini-2.5-flash-preview-05-20` | 最新快速模型 | 支持思考模式 |
| `gemini-2.5-pro-preview-06-05` | 最新专业模型 | 最强推理能力 |

## 🔧 高级配置

### 思考模式
Gemini 2.5 模型支持思考模式，可以显示模型的推理过程：

```javascript
{
  "model": "gemini-2.5-flash-preview-05-20",
  "messages": [...],
  "enable_thinking": true  // 启用思考模式
}
```

### 自然输出
系统会自动优化输出格式，减少过度的 markdown 格式化，提供更自然的对话体验。JSON 请求不受影响。

### Token 管理
- **无限制设置**：默认使用最大 token 限制
- **用户指定**：完全尊重用户的 `max_tokens` 设置
- **智能超时**：根据请求大小动态调整超时时间

## 🚀 部署

### Deno Deploy
1. Fork 此仓库
2. 连接到 Deno Deploy
3. 设置环境变量
4. 部署完成

### Docker（可选）
```dockerfile
FROM denoland/deno:alpine

WORKDIR /app
COPY . .

RUN deno cache main.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]
```

## 📊 监控和日志

服务提供详细的日志输出：
- 请求详情（参数、模型、token 使用）
- 响应状态（成功/失败、完成原因）
- 错误信息（重试、故障转移）
- 性能指标（响应时间、token 统计）

## 🔒 安全性

- 支持访问密码验证
- API 密钥安全存储
- 请求日志不包含敏感信息
- 支持 HTTPS 部署

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
