# Gemini 到 OpenAI 兼容 API 服务器

基于 Deno 的 API 服务器，为 Google 的 Gemini API 提供 OpenAI 兼容的端点，使现有的基于 OpenAI 的应用程序能够无缝集成。

## 特性

- 🔄 **完全 OpenAI 兼容**: 支持 `/v1/chat/completions` 和 `/v1/models` 端点
- 🚀 **流式支持**: 使用服务器发送事件的实时流式响应
- 🖼️ **多模态支持**: 无缝处理文本和图像输入
- 🛠️ **函数调用**: 完整的工具/函数调用支持
- 🔑 **API 密钥负载均衡**: 在多个 Gemini API 密钥间自动轮换
- 📊 **动态模型列表**: 直接从 Google 获取可用模型
- 🌐 **CORS 支持**: 为 Web 应用程序提供可配置的 CORS
- 🔒 **错误处理**: 具有重试逻辑的全面错误处理
- 📝 **TypeScript**: 具有全面类型定义的完全类型化

## 快速开始

### 1. 前提条件

- 系统上安装了 [Deno](https://deno.land/)
- 从 [Google AI Studio](https://makersuite.google.com/app/apikey) 获取 Google Gemini API 密钥

### 2. 设置

1. 克隆或下载此项目
2. 复制 `.env.example` 到 `.env`:
   ```bash
   cp .env.example .env
   ```
3. 编辑 `.env` 并添加您的配置:
   ```env
   # Gemini API 密钥
   GEMINI_API_KEYS=your_gemini_key_1,your_gemini_key_2

   # 准入密码（客户端需要提供）
   ACCESS_KEYS=your_access_key_1,your_access_key_2
   ```

### 3. 运行服务器

```bash
# 开发模式（带自动重载）
deno task dev

# 生产模式
deno task start
```

服务器默认将在 `http://localhost:8000` 上启动。

## 部署到 Deno Deploy

本项目专为 Deno Deploy 设计。详细部署说明请参见 [DEPLOY.md](./DEPLOY.md)。

## 使用方法

### 聊天补全

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [
      {"role": "user", "content": "你好，你怎么样？"}
    ],
    "stream": false
  }'
```

### 流式聊天

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [
      {"role": "user", "content": "给我讲个故事"}
    ],
    "stream": true
  }'
```

### 列出模型

```bash
curl -H "Authorization: Bearer your_access_key" \
  http://localhost:8000/v1/models
```

### 多模态（视觉）

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "你在这张图片中看到了什么？"},
          {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
        ]
      }
    ]
  }'
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEYS` | Comma-separated list of Gemini API keys | Required |
| `PORT` | Server port | `8000` |
| `CORS_ORIGIN` | CORS allowed origins | `*` |
| `LOG_LEVEL` | Logging level (debug/info/warn/error) | `info` |
| `MAX_RETRIES` | Maximum retry attempts per request | `3` |
| `REQUEST_TIMEOUT` | Request timeout in milliseconds | `30000` |

### Supported Models

The server dynamically fetches available models from Google's API. Common models include:

- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-1.0-pro`
- And more...

Use the `/v1/models` endpoint to get the current list.

## OpenAI Compatibility

This server implements the following OpenAI API features:

### Supported Parameters

- `model` - Gemini model name
- `messages` - Conversation history
- `temperature` - Response randomness (0-2)
- `top_p` - Nucleus sampling parameter
- `max_tokens` - Maximum response length
- `stream` - Enable streaming responses
- `tools` - Function/tool definitions
- `tool_choice` - Tool selection strategy
- `stop` - Stop sequences
- `response_format` - JSON response format

### Message Types

- `system` - System instructions
- `user` - User messages (text and images)
- `assistant` - AI responses
- `tool` - Tool/function results

## Architecture

```
├── main.ts                 # Main server entry point
├── types/
│   ├── openai.ts          # OpenAI API type definitions
│   └── gemini.ts          # Gemini API type definitions
├── config/
│   └── env.ts             # Configuration and environment management
├── services/
│   ├── modelService.ts    # Model management and validation
│   └── geminiClient.ts    # Gemini API client with retry logic
└── transformers/
    ├── openaiToGemini.ts  # Request transformation
    ├── geminiToOpenAI.ts  # Response transformation
    └── streamTransformer.ts # Streaming response transformation
```

## Error Handling

The server provides comprehensive error handling:

- **Rate Limiting**: Automatic retry with different API keys
- **Network Errors**: Exponential backoff retry logic
- **Invalid Requests**: Proper validation with descriptive errors
- **API Errors**: Gemini errors transformed to OpenAI format

## Development

### Running Tests

```bash
deno test --allow-net --allow-env
```

### Code Formatting

```bash
deno fmt
```

### Linting

```bash
deno lint
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:

1. Check the existing issues
2. Create a new issue with detailed information
3. Include logs and configuration (without API keys)
