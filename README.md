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
- **Gemini 2.0 Flash** - 实验性模型，多模态支持

### 🖼️ **强大的多模态支持**
- **图片识别** - 支持 PNG、JPEG 格式
- **GIF 动图支持** - 自动处理 GIF 格式，转换为静态图片分析
- **多图片处理** - 单次请求支持多张图片
- **智能格式转换** - 自动优化图片格式以提高兼容性

### 🛠️ **智能优化功能**
- **思考模式控制** - 支持 `enable_thinking` 参数，默认禁用优化性能
- **自然输出优化** - 自动减少过度 Markdown 格式化
- **智能 JSON 处理** - 自动检测 JSON 请求并确保纯净输出，完全忽略小 token 限制
- **无限制 Token 管理** - JSON 请求使用最大 token 限制，确保响应完整性
- **多密钥轮换** - 自动负载均衡和故障转移

### 🚀 **企业级特性**
- 详细的中文日志记录
- 完善的错误处理和重试机制
- 动态超时时间调整
- 环境变量配置
- **Deno Deploy 一键部署**

## 🚀 快速开始

### 🌐 Deno Deploy 部署（推荐）

#### 1. Fork 项目
- 访问项目仓库并点击 **Fork** 按钮
- 将项目 Fork 到您的 GitHub 账户

#### 2. 部署到 Deno Deploy
1. 访问 [Deno Deploy](https://dash.deno.com/)
2. 点击 **New Project**
3. 选择您 Fork 的项目仓库
4. 配置部署设置：
   - **Branch**: `main`
   - **Entry Point**: `main.ts`
5. 点击 **Deploy** 开始部署

#### 3. 配置环境变量
部署成功后，在 Deno Deploy 项目设置中添加环境变量：

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `GEMINI_API_KEYS` | Gemini API 密钥（多个用逗号分隔） | `AIzaSy...abc,AIzaSy...def` |
| `ACCESS_PASSWORDS` | 访问密码（用于API认证） | `sk-123456` |

#### 4. 完成部署
- 保存环境变量后，服务会自动重启
- 您的 API 服务现在可以通过 Deno Deploy 提供的 URL 访问

### 💻 本地开发

#### 1. 克隆项目
```bash
git clone <repository-url>
cd gemini-api-proxy
```

#### 2. 配置环境变量
```bash
cp .env.example .env
```

编辑 `.env` 文件：
```env
# Gemini API 密钥（多个用逗号分隔）
GEMINI_API_KEYS=your-gemini-api-key-1,your-gemini-api-key-2

# 访问密码（用于API认证）
ACCESS_PASSWORDS=your-access-password

# 服务端口（可选，默认8000）
PORT=8000
<<<<<<< HEAD
=======

# 访问密码（可选）
ACCESS_KEY=your-access-password

# 日志级别
LOG_LEVEL=INFO

# 请求超时时间（毫秒）
REQUEST_TIMEOUT=30000
>>>>>>> 2e0ad827a7e1bda69aa8cc23d8174cc489df06b8
```

#### 3. 启动服务
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

### 图片识别（支持 PNG、JPEG、GIF）
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-password" \
  -d '{
    "model": "gemini-1.5-flash",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "请描述这张图片"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAWA0ddgAAAABJRU5ErkJggg=="
            }
          }
        ]
      }
    ]
  }'
```

### GIF 动图识别
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-access-password" \
  -d '{
    "model": "gemini-2.0-flash",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "请分析这个GIF动图"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            }
          }
        ]
      }
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

## 🚀 生产部署

### 🌐 Deno Deploy（推荐）

Deno Deploy 是最简单的部署方式，提供全球 CDN 和自动扩缩容：

#### 详细部署步骤

1. **Fork 项目**
   - 访问项目 GitHub 仓库
   - 点击右上角的 **Fork** 按钮
   - 选择您的 GitHub 账户

2. **创建 Deno Deploy 项目**
   - 访问 [dash.deno.com](https://dash.deno.com/)
   - 使用 GitHub 账户登录
   - 点击 **New Project**

3. **配置项目**
   - **Repository**: 选择您 Fork 的仓库
   - **Branch**: 选择 `main` 分支
   - **Entry Point**: 设置为 `main.ts`
   - 点击 **Deploy**

4. **设置环境变量**
   - 在项目设置页面，找到 **Environment Variables**
   - 添加以下变量：
     ```
     GEMINI_API_KEYS=your_api_key_1,your_api_key_2
     ACCESS_PASSWORDS=sk-123456
     ```
   - 点击 **Save** 保存

5. **验证部署**
   - 部署完成后，您会获得一个 `.deno.dev` 域名
   - 访问 `https://your-project.deno.dev/v1/models` 验证服务

### 🐳 Docker 部署（可选）

```dockerfile
FROM denoland/deno:alpine

WORKDIR /app
COPY . .

RUN deno cache main.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]
```

构建和运行：
```bash
docker build -t gemini-proxy .
docker run -p 8000:8000 \
  -e GEMINI_API_KEYS=your_api_keys \
  -e ACCESS_PASSWORDS=your_password \
  gemini-proxy
```

## 🎉 最新功能亮点

### ✨ **v2.1 新特性**
- **🖼️ 完整多模态支持** - 支持 PNG、JPEG、GIF 图片识别
- **🎬 GIF 动图处理** - 自动处理 GIF 格式，智能转换提高兼容性
- **🔍 智能 JSON 检测** - 自动识别 JSON 请求，完全忽略小 token 限制
- **🧠 思考模式优化** - 默认禁用思考功能，显著提升响应速度
- **🎨 自然输出优化** - 自动减少过度格式化，提供更自然的对话体验
- **⚡ 无限制 Token** - JSON 请求使用最大 token 限制，确保响应完整性
- **🛠️ 完整工具调用** - 100% 兼容 OpenAI Function Calling 格式

### 🔧 **技术优化**
- **🖼️ 智能图片处理** - 自动格式转换，大小限制，错误处理
- **📏 动态大小限制** - GIF 2MB，普通图片 10MB
- **⏱️ 动态超时调整** - 根据请求复杂度智能调整超时时间
- **🔄 多密钥轮换** - 自动负载均衡和故障转移
- **📝 中文日志系统** - 详细的中文日志记录
- **🛡️ 错误恢复机制** - 完善的重试和错误处理

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
