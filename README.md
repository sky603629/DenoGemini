# Gemini 到 OpenAI 兼容 API 服务器 (高并发优化版)

基于 Deno 的高性能 API 服务器，为 Google 的 Gemini API 提供 OpenAI 兼容的端点，支持 Gemini 2.5 思考模型，具备企业级并发处理能力。

## ✨ 核心特性

### 🧠 **Gemini 2.5 思考模型支持**
- **智能思考模式**: 支持 Gemini 2.5 Flash/Pro 的思考功能
- **按需启用**: 通过 `enable_thinking` 参数控制思考模式
- **默认优化**: 简单对话自动禁用思考，复杂问题智能启用
- **格式兼容**: 完美支持 `<think>` 标签和思考内容分离

### 🚀 **高并发性能优化**
- **并发管理**: 支持最多 50 个同时请求处理
- **智能队列**: 1000 个请求排队缓冲
- **连接池**: HTTP 连接复用，减少延迟
- **优先级调度**: 流式请求优先处理
- **API 限制管理**: 自动检测和避免速率限制

### 🎨 **智能格式优化**
- **自然文本输出**: 自动清理过度的 Markdown 格式
- **连贯段落**: 智能合并短句，生成流畅文本
- **JSON 格式保护**: 完美保持 JSON 响应格式完整性
- **特殊字符清理**: 移除零宽字符和异常空格

### 📊 **实时监控系统**
- **健康检查**: `/health` 端点提供实时状态
- **性能统计**: `/stats` 端点显示详细指标
- **并发监控**: 队列利用率、响应时间统计
- **成功率追踪**: 实时错误率和性能分析

### 🔄 **完全 OpenAI 兼容**
- **标准端点**: `/v1/chat/completions` 和 `/v1/models`
- **流式支持**: 实时流式响应 (SSE)
- **多模态支持**: 文本和图像输入处理
- **函数调用**: 完整的工具/函数调用支持
- **API 密钥轮换**: 多密钥负载均衡

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

### 4. 验证服务状态

```bash
# 检查服务健康状态
curl http://localhost:8000/health

# 查看性能统计
curl http://localhost:8000/stats

# 查看主页信息
curl http://localhost:8000/
```

## 部署到 Deno Deploy

本项目专为 Deno Deploy 设计。详细部署说明请参见 [DEPLOY.md](./DEPLOY.md)。

## 🚀 使用方法

### 基础聊天补全

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-2.5-flash-preview-05-20",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下你自己"}
    ]
  }'
```

### Gemini 2.5 思考模式

```bash
# 启用思考模式 - 适合复杂推理问题
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-2.5-flash-preview-05-20",
    "messages": [
      {"role": "user", "content": "请分析：如果所有的猫都是动物，所有的动物都需要食物，那么所有的猫都需要食物。这个推理是否正确？"}
    ],
    "enable_thinking": true
  }'

# 禁用思考模式 - 适合简单对话
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-2.5-flash-preview-05-20",
    "messages": [
      {"role": "user", "content": "今天天气怎么样？"}
    ],
    "enable_thinking": false
  }'
```

### JSON 格式响应

```bash
# 请求 JSON 格式回复
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-2.5-flash-preview-05-20",
    "messages": [
      {"role": "user", "content": "请用JSON格式返回一个用户信息示例，包含姓名、年龄、邮箱"}
    ]
  }'
```

### 流式聊天

```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-2.5-flash-preview-05-20",
    "messages": [
      {"role": "user", "content": "给我讲个关于人工智能的故事"}
    ],
    "stream": true
  }'
```

### 列出可用模型

```bash
curl -H "Authorization: Bearer your_access_key" \
  http://localhost:8000/v1/models
```

### 多模态（视觉）支持

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
          {"type": "text", "text": "请描述这张图片中的内容"},
          {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
        ]
      }
    ]
  }'
```

### 性能监控

```bash
# 健康检查
curl http://localhost:8000/health

# 详细统计信息
curl http://localhost:8000/stats

# 示例响应
{
  "status": "healthy",
  "performance": {
    "queueUtilization": "15%",
    "concurrencyUtilization": "60%",
    "averageResponseTime": "2500ms",
    "successRate": "98%"
  }
}
```

## ⚙️ 配置说明

### 环境变量

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| `GEMINI_API_KEYS` | Gemini API 密钥列表（逗号分隔） | - | ✅ |
| `ACCESS_KEYS` | 客户端访问密钥列表（逗号分隔） | - | ✅ |
| `PORT` | 服务器端口 | `8000` | ❌ |
| `CORS_ORIGIN` | CORS 允许的源 | `*` | ❌ |
| `LOG_LEVEL` | 日志级别 (debug/info/warn/error) | `info` | ❌ |
| `MAX_RETRIES` | 最大重试次数 | `3` | ❌ |
| `REQUEST_TIMEOUT` | 请求超时时间（毫秒） | `30000` | ❌ |

### 支持的模型

服务器动态获取 Google API 的可用模型，包括：

#### Gemini 2.5 系列（支持思考模式）
- `gemini-2.5-flash-preview-05-20` - 快速响应，支持思考
- `gemini-2.5-pro-preview-05-20` - 高质量输出，支持思考

#### Gemini 1.5 系列
- `gemini-1.5-pro` - 高性能多模态模型
- `gemini-1.5-flash` - 快速响应模型
- `gemini-1.5-pro-vision` - 视觉专用模型

#### Gemini 1.0 系列
- `gemini-1.0-pro` - 基础对话模型

使用 `/v1/models` 端点获取完整的当前可用模型列表。

### 性能配置

| 参数 | 描述 | 默认值 |
|------|------|--------|
| 最大并发请求 | 同时处理的请求数 | 50 |
| 队列大小 | 排队等待的请求数 | 1000 |
| 连接池大小 | HTTP 连接复用数量 | 20 |
| API 限制检测 | 自动速率限制管理 | 启用 |

## 🔧 Gemini 2.5 思考模式详解

### 思考模式工作原理

Gemini 2.5 思考模式允许模型在回答前进行内部推理，类似于人类的思考过程：

```json
{
  "model": "gemini-2.5-flash-preview-05-20",
  "messages": [{"role": "user", "content": "复杂问题"}],
  "enable_thinking": true
}
```

**响应格式**：
```
<think>
模型的内部思考过程（通常是英文）
分析问题、考虑方案、推理步骤
</think>

最终的回答内容（中文）
```

### 智能思考模式选择

系统会自动判断是否需要启用思考：

- **自动禁用思考**：简单问候、基础查询、短问题
- **建议启用思考**：逻辑推理、复杂分析、数学问题、创意任务

### 最佳实践

#### 何时启用思考模式 ✅
- 复杂的逻辑推理问题
- 数学计算和证明
- 多步骤分析任务
- 创意写作和故事构思
- 技术问题诊断

#### 何时禁用思考模式 ❌
- 简单的问候对话
- 基础信息查询
- 直接的事实回答
- 简单的翻译任务
- 快速响应需求

## 📊 性能监控

### 健康检查端点

```bash
GET /health
```

**响应示例**：
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "performance": {
    "queueUtilization": "15%",
    "concurrencyUtilization": "60%",
    "averageResponseTime": "2500ms",
    "successRate": "98%"
  },
  "connections": {
    "total": 15,
    "active": 8,
    "max": 20
  }
}
```

### 详细统计端点

```bash
GET /stats
```

**响应示例**：
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "concurrency": {
    "totalRequests": 1250,
    "completedRequests": 1225,
    "failedRequests": 25,
    "activeRequests": 8,
    "queueLength": 3,
    "averageResponseTime": 2184
  },
  "connections": {
    "totalConnections": 15,
    "activeConnections": 8,
    "maxConnections": 20
  }
}
```

## 🔄 OpenAI 兼容性

本服务器实现了 OpenAI Chat Completions API 规范，具有以下特性：

### 支持的参数

- `model` - Gemini 模型名称
- `messages` - 对话历史
- `temperature` - 响应随机性 (0-2)
- `top_p` - 核采样参数
- `max_tokens` - 最大响应长度
- `stream` - 启用流式响应
- `tools` - 函数/工具定义
- `tool_choice` - 工具选择策略
- `stop` - 停止序列
- `response_format` - JSON 响应格式
- `enable_thinking` - **新增：启用思考模式**

### 消息类型

- `system` - 系统指令
- `user` - 用户消息（文本和图像）
- `assistant` - AI 响应
- `tool` - 工具/函数结果

### 完整功能支持

- ✅ 支持 system、user、assistant 角色消息
- ✅ 服务器发送事件的流式响应
- ✅ 函数/工具调用支持
- ✅ 多模态输入（文本 + 图像）
- ✅ Temperature 和其他生成参数
- ✅ 响应中的使用统计信息
- ✅ 适当 HTTP 状态码的错误处理
- ✅ **Gemini 2.5 思考模式扩展**
- ✅ **智能格式优化**
- ✅ **高并发处理能力**

### 与 OpenAI 的差异

- 模型名称对应 Gemini 模型而非 OpenAI 模型
- 新增 `enable_thinking` 参数用于控制思考模式
- 响应格式可能因底层 API 差异而略有不同
- 某些高级 OpenAI 功能可能不可用

## 🏗️ 系统架构

```
├── main.ts                      # 主服务器入口点
├── types/
│   ├── openai.ts               # OpenAI API 类型定义
│   └── gemini.ts               # Gemini API 类型定义
├── config/
│   └── env.ts                  # 配置和环境管理
├── services/
│   ├── modelService.ts         # 模型管理和验证
│   ├── geminiClient.ts         # Gemini API 客户端（带重试逻辑）
│   ├── concurrencyManager.ts  # 并发管理器
│   └── imageCache.ts           # 图像缓存服务
├── transformers/
│   ├── openaiToGemini.ts       # 请求转换（支持思考模式）
│   ├── geminiToOpenAI.ts       # 响应转换（智能格式清理）
│   └── streamTransformer.ts    # 流式响应转换
└── middleware/
    └── auth.ts                 # 身份验证中间件
```

## 🛡️ 错误处理

服务器提供全面的错误处理机制：

- **速率限制**: 自动使用不同 API 密钥重试
- **网络错误**: 指数退避重试逻辑
- **无效请求**: 适当验证和描述性错误
- **API 错误**: Gemini 错误转换为 OpenAI 格式
- **并发控制**: 队列满时的优雅降级
- **健康监控**: 实时状态检查和性能监控

## 🚀 性能特性

### 并发处理能力
- **最大并发**: 50 个同时请求
- **队列缓冲**: 1000 个请求排队
- **连接复用**: HTTP 连接池优化
- **智能调度**: 优先级队列管理

### 响应优化
- **格式清理**: 自动移除过度 Markdown 格式
- **JSON 保护**: 完美保持 JSON 响应完整性
- **连贯文本**: 智能段落合并和句子优化
- **特殊字符**: 清理零宽字符和异常空格

### 监控指标
- **实时统计**: 请求数、成功率、响应时间
- **健康状态**: 队列利用率、并发利用率
- **性能分析**: P50/P95/P99 响应时间统计

## 📈 版本历史

### v2.0.0 - 高并发优化版 (当前版本)
- ✅ 新增 Gemini 2.5 思考模式支持
- ✅ 实现高并发处理能力（50并发）
- ✅ 智能格式优化和清理
- ✅ 实时性能监控系统
- ✅ 连接池和队列管理
- ✅ JSON 格式完美保护

### v1.0.0 - 基础版本
- ✅ OpenAI API 兼容性
- ✅ 基础 Gemini 模型支持
- ✅ 流式响应
- ✅ 多模态支持

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

### 开发环境设置

```bash
# 克隆仓库
git clone <repository-url>
cd gemini-openai-proxy

# 安装 Deno
curl -fsSL https://deno.land/install.sh | sh

# 运行开发服务器
deno task dev

# 运行测试
deno test --allow-all
```

## 📞 支持

如果您遇到问题或有功能请求：

1. 查看 [Issues](../../issues) 页面
2. 创建新的 Issue 描述问题
3. 提供详细的错误信息和复现步骤

## 🙏 致谢

感谢以下项目和贡献者：

- [Deno](https://deno.land/) - 现代 JavaScript/TypeScript 运行时
- [Google Gemini API](https://ai.google.dev/) - 强大的 AI 模型
- [OpenAI API](https://openai.com/api/) - API 标准规范

## 📄 许可证

MIT License - 详见 LICENSE 文件。

---

**🚀 现在就开始使用高性能的 Gemini 2.5 API 代理服务！**
