# 快速设置指南

## 🚀 5分钟快速启动

### 1. 配置环境变量

复制并编辑配置文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，添加您的配置：
```env
# Gemini API密钥（必需）
GEMINI_API_KEYS=your_gemini_key_1,your_gemini_key_2

# 准入密码（必需）- 客户端需要提供这些密码才能使用服务
ACCESS_KEYS=your_access_key_1,your_access_key_2

# 可选配置
PORT=8000
CORS_ORIGIN=*
LOG_LEVEL=info
```

### 2. 启动服务

```bash
deno task dev
```

### 3. 测试服务

```bash
# 测试身份验证
deno task test:auth http://localhost:8000 your_access_key_1

# 完整验证
deno task verify:local your_access_key_1
```

## 🔐 身份验证说明

### 支持的身份验证方式

客户端可以使用以下任一方式提供API密钥：

1. **Bearer Token（推荐）**：
   ```bash
   curl -H "Authorization: Bearer your_access_key" ...
   ```

2. **x-api-key Header**：
   ```bash
   curl -H "x-api-key: your_access_key" ...
   ```

3. **Authorization Header（不带Bearer）**：
   ```bash
   curl -H "Authorization: your_access_key" ...
   ```

### 客户端集成示例

#### Python (OpenAI库)
```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="your_access_key"  # 使用您的准入密码
)

response = client.chat.completions.create(
    model="gemini-1.5-pro",
    messages=[{"role": "user", "content": "你好"}]
)
```

#### JavaScript
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:8000/v1',
  apiKey: 'your_access_key'  // 使用您的准入密码
});

const response = await openai.chat.completions.create({
  model: 'gemini-1.5-pro',
  messages: [{ role: 'user', content: '你好' }]
});
```

#### cURL
```bash
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_key" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 🛠️ 常用命令

```bash
# 开发模式启动
deno task dev

# 生产模式启动
deno task start

# 测试基本功能
deno task test

# 测试身份验证
deno task test:auth [URL] [API密钥]

# 测试图片功能
deno task test:image

# 网络诊断
deno task diagnose

# 验证部署
deno task verify [URL] [API密钥]

# 图片转换工具
deno task convert:image [图片路径或URL]
```

## 🔧 配置选项

| 环境变量 | 说明 | 默认值 | 必需 |
|---------|------|--------|------|
| `GEMINI_API_KEYS` | Gemini API密钥（逗号分隔） | - | ✅ |
| `ACCESS_KEYS` | 准入密码（逗号分隔） | - | ✅ |
| `PORT` | 服务器端口 | `8000` | ❌ |
| `CORS_ORIGIN` | CORS允许的源 | `*` | ❌ |
| `LOG_LEVEL` | 日志级别 | `info` | ❌ |
| `MAX_RETRIES` | 最大重试次数 | `3` | ❌ |
| `REQUEST_TIMEOUT` | 请求超时时间(ms) | `30000` | ❌ |

## 🚨 安全注意事项

1. **保护您的密钥**：
   - 不要在代码中硬编码API密钥
   - 使用强密码作为准入密码
   - 定期轮换密钥

2. **网络安全**：
   - 在生产环境中使用HTTPS
   - 配置适当的CORS设置
   - 考虑使用防火墙限制访问

3. **监控和日志**：
   - 监控API使用情况
   - 检查异常的访问模式
   - 定期查看日志

## 🐛 故障排除

### 常见问题

1. **401 Unauthorized**
   - 检查是否提供了正确的API密钥
   - 确认密钥在 `ACCESS_KEYS` 中

2. **连接错误**
   - 运行 `deno task diagnose` 检查网络
   - 检查防火墙设置

3. **模型不可用**
   - 使用 `/v1/models` 查看可用模型
   - 检查Gemini API配额

4. **图片处理失败**
   - 使用 `deno task convert:image` 转换图片
   - 确保图片格式支持且小于4MB

### 获取帮助

- 查看日志了解详细错误信息
- 使用诊断工具检查配置
- 参考 README.md 获取更多信息

---

🎉 现在您的Gemini到OpenAI兼容API服务器已经配置完成！
