# Gemini API Proxy

一个基于 Deno 的高性能代理服务，为 Google Gemini 模型提供完全兼容 OpenAI API 的接口。

## ✨ 核心特性

### 🔄 **100% OpenAI API 兼容**
- 标准的 `/v1/chat/completions` 接口
- 完整的工具调用 (Function Calling) 支持
- 流式和非流式响应
- **智能 JSON 检测** - 自动识别并优化 JSON 格式请求

### 🧠 **全面 Gemini 模型支持**
- **Gemini 1.5 Flash** - 快速响应，适合日常对话
- **Gemini 1.5 Pro** - 高质量输出，适合复杂任务
- **Gemini 2.5 Flash** - 最新模型，支持思考模式
- **Gemini 2.5 Pro** - 顶级模型，最强推理能力
- **Gemini 2.0 Flash** - 实验性模型支持

### 🛠️ **智能优化功能**
- **思考模式控制** - 支持 `enable_thinking` 参数，默认禁用优化性能
- **自然输出优化** - 自动减少过度 Markdown 格式化
- **智能 JSON 处理** - 自动检测 JSON 请求并确保纯净输出
- **无限制 Token 管理** - 完全尊重用户设置，默认使用最大限制
- **多密钥轮换** - 自动负载均衡和故障转移

### 🚀 **企业级特性**
- 详细的中文日志记录
- 完善的错误处理和重试机制
- 动态超时时间调整
- 环境变量配置
- Deno Deploy 一键部署

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
ACCESS_KEY=your-access-password

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

## 📖 API 使用指南

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

### 智能 JSON 响应（自动检测）
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-password" \
  -d '{
    "model": "gemini-2.5-flash-preview-05-20",
    "messages": [
      {"role": "user", "content": "请用JSON格式返回用户信息，包含姓名和年龄"}
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
      {"role": "user", "content": "分析这个复杂的逻辑问题"}
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

## 🎛️ 完整参数支持

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `model` | string | 模型名称 | 必需 |
| `messages` | array | 对话消息 | 必需 |
| `temperature` | number | 随机性控制 (0-2) | 1.0 |
| `top_p` | number | 核采样参数 (0-1) | 1.0 |
| `max_tokens` | number | 最大输出 tokens | 无限制 |
| `stream` | boolean | 是否流式响应 | false |
| `stop` | string/array | 停止序列 | null |
| `tools` | array | 工具定义 | null |
| `tool_choice` | string/object | 工具选择策略 | "auto" |
| `response_format` | object | 响应格式 | 智能检测 |
| `enable_thinking` | boolean | 启用思考模式 (仅2.5) | false |

## 🤖 全模型支持

| 模型名称 | 描述 | 特殊功能 |
|----------|------|----------|
| `gemini-1.5-flash` | 快速响应模型 | 高速、低延迟、多模态 |
| `gemini-1.5-pro` | 专业级模型 | 高质量输出、复杂推理 |
| `gemini-2.0-flash` | 实验性模型 | 最新技术预览 |
| `gemini-2.5-flash-preview-05-20` | 最新快速模型 | 思考模式、高性能 |
| `gemini-2.5-pro-preview-06-05` | 最新专业模型 | 最强推理、思考模式 |

## 🔧 高级配置与优化

### 🧠 思考模式 (Thinking Mode)
Gemini 2.5 模型支持思考模式，显示完整的推理过程：

```javascript
{
  "model": "gemini-2.5-flash-preview-05-20",
  "messages": [...],
  "enable_thinking": true  // 启用思考模式
}
```

**特点**：
- 默认禁用以优化性能 (`thinkingBudget: 0`)
- 显示 `<think>...</think>` 标签包围的推理过程
- 适合复杂逻辑分析和多步推理任务

### 🎯 智能 JSON 检测
系统自动检测 JSON 请求并优化输出：

**自动检测关键词**：
- `json格式`、`JSON对象`、`返回json`
- `{"nickname": "昵称"}`、`请用json`
- 包含 JSON 示例的提示

**自动优化**：
- 跳过自然输出格式化
- 应用 JSON 专用提示词
- 确保返回纯净的 JSON 格式

### 🌟 自然输出优化
- **智能格式化**：自动减少过度的 Markdown 格式
- **禁用星号**：避免 `**粗体**` 和 `* 列表` 格式
- **流畅对话**：提供更自然的对话体验
- **JSON 兼容**：JSON 请求不受格式化影响

### ⚡ Token 管理策略
- **无限制默认**：使用模型最大 token 限制 (65536/8192)
- **完全尊重用户设置**：不对用户指定的 `max_tokens` 做任何调整
- **智能超时**：根据请求大小和模型类型动态调整超时时间
- **性能优化**：思考模式默认禁用以提升响应速度

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

## 🎉 最新功能亮点

### ✨ **v2.0 新特性**
- **🔍 智能 JSON 检测** - 自动识别 JSON 请求，无需手动设置 `response_format`
- **🧠 思考模式优化** - 默认禁用思考功能，显著提升响应速度
- **🎨 自然输出优化** - 自动减少过度格式化，提供更自然的对话体验
- **⚡ 无限制 Token** - 完全移除 token 限制，尊重用户设置
- **🛠️ 完整工具调用** - 100% 兼容 OpenAI Function Calling 格式

### 🔧 **技术优化**
- **动态超时调整** - 根据请求复杂度智能调整超时时间
- **多密钥轮换** - 自动负载均衡和故障转移
- **中文日志系统** - 详细的中文日志记录
- **错误恢复机制** - 完善的重试和错误处理

## 📊 监控和日志

服务提供详细的中文日志输出：
- **请求详情** - 参数、模型、token 使用统计
- **响应状态** - 成功/失败、完成原因、处理时间
- **错误信息** - 重试机制、故障转移、API 状态
- **性能指标** - 响应时间、token 统计、并发处理
- **智能检测** - JSON 检测、思考模式状态、格式优化

## 🔒 安全性

- 支持访问密码验证
- API 密钥安全存储
- 请求日志不包含敏感信息
- 支持 HTTPS 部署

## 🤝 贡献指南

我们欢迎各种形式的贡献！

### 🐛 **报告问题**
- 使用 GitHub Issues 报告 bug
- 提供详细的错误信息和复现步骤
- 包含相关的日志输出

### 💡 **功能建议**
- 在 Issues 中提出新功能建议
- 描述使用场景和预期效果
- 讨论实现方案

### 🔧 **代码贡献**
- Fork 项目并创建功能分支
- 遵循现有代码风格
- 添加必要的测试和文档
- 提交 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢 Google 提供强大的 Gemini API
感谢 Deno 团队提供优秀的运行时环境
感谢所有贡献者和用户的支持
