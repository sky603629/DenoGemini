# Deno Deploy 部署指南

本项目专为 Deno Deploy 平台设计，提供简单快速的部署方式。

## 部署到 Deno Deploy

### 1. 准备工作

1. 注册 [Deno Deploy](https://deno.com/deploy) 账户
2. 获取 Gemini API 密钥：
   - 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
   - 创建新的 API 密钥
   - 建议创建多个密钥以实现负载均衡

### 2. 部署步骤

#### 方法一：通过 GitHub 连接（推荐）

1. 将代码推送到 GitHub 仓库
2. 在 Deno Deploy 控制台中：
   - 点击 "New Project"
   - 选择 "Deploy from GitHub"
   - 连接您的 GitHub 账户
   - 选择包含此代码的仓库
   - 设置入口文件为 `main.ts`

#### 方法二：直接上传

1. 在 Deno Deploy 控制台中：
   - 点击 "New Project"
   - 选择 "Deploy from local files"
   - 上传所有项目文件
   - 设置入口文件为 `main.ts`

### 3. 环境变量配置

在 Deno Deploy 项目设置中添加以下环境变量：

```
GEMINI_API_KEYS=your_key_1,your_key_2,your_key_3
PORT=8000
CORS_ORIGIN=*
LOG_LEVEL=info
MAX_RETRIES=3
REQUEST_TIMEOUT=30000
```

**重要说明：**
- `GEMINI_API_KEYS`: 必需，多个密钥用逗号分隔
- `PORT`: Deno Deploy 会自动设置，通常不需要手动配置
- 其他变量为可选，有默认值

### 4. 验证部署

部署完成后，您的 API 将在 `https://your-project.deno.dev` 可用。

测试端点：
```bash
# 获取可用模型
curl https://your-project.deno.dev/v1/models

# 测试聊天补全
curl -X POST https://your-project.deno.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 使用说明

### 支持的端点

- `GET /v1/models` - 获取可用模型列表
- `POST /v1/chat/completions` - 聊天补全（兼容 OpenAI 格式）

### 支持的功能

- ✅ 文本对话
- ✅ 流式响应
- ✅ 多模态输入（图像）
- ✅ 函数调用/工具使用
- ✅ 系统提示
- ✅ 温度、top_p 等参数
- ✅ 多密钥负载均衡
- ✅ 自动重试机制

### 客户端集成

您可以使用任何支持 OpenAI API 的客户端库，只需将 base URL 更改为您的 Deno Deploy URL：

```python
# Python 示例
import openai

client = openai.OpenAI(
    base_url="https://your-project.deno.dev/v1",
    api_key="dummy"  # 不需要真实的 OpenAI 密钥
)

response = client.chat.completions.create(
    model="gemini-1.5-pro",
    messages=[{"role": "user", "content": "你好"}]
)
```

```javascript
// JavaScript 示例
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://your-project.deno.dev/v1',
  apiKey: 'dummy'  // 不需要真实的 OpenAI 密钥
});

const response = await openai.chat.completions.create({
  model: 'gemini-1.5-pro',
  messages: [{ role: 'user', content: '你好' }]
});
```

## 监控和日志

- Deno Deploy 提供内置的日志查看功能
- 可以在项目控制台中查看实时日志
- 建议设置 `LOG_LEVEL=info` 以获得适当的日志详细程度

## 故障排除

### 常见问题

1. **API 密钥错误**
   - 确保在环境变量中正确设置了 `GEMINI_API_KEYS`
   - 验证密钥是否有效且有足够的配额

2. **模型不可用**
   - 检查模型名称是否正确
   - 使用 `/v1/models` 端点查看可用模型

3. **请求超时**
   - 增加 `REQUEST_TIMEOUT` 值
   - 检查网络连接

4. **速率限制**
   - 添加更多 API 密钥实现负载均衡
   - 增加 `MAX_RETRIES` 值

### 性能优化

- 使用多个 API 密钥以提高并发处理能力
- 适当设置超时值以平衡响应时间和稳定性
- 监控日志以识别性能瓶颈

## 安全注意事项

- 不要在代码中硬编码 API 密钥
- 使用环境变量管理敏感信息
- 根据需要配置 CORS 设置
- 定期轮换 API 密钥

## 更新部署

如果使用 GitHub 连接：
- 推送代码到 GitHub 仓库即可自动部署

如果使用直接上传：
- 重新上传修改后的文件到 Deno Deploy

---

有问题？请查看 [Deno Deploy 文档](https://deno.com/deploy/docs) 或提交 Issue。
