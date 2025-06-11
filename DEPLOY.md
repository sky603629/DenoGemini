# 🚀 Deno Deploy 部署指南

## 📋 部署概述

本项目支持**渐进式部署**：
1. ✅ 先部署成功（无需环境变量）
2. ⚙️ 后配置密钥（通过 Deno Deploy 控制台）
3. 🎉 完整功能可用

## 🔧 部署步骤

### 步骤 1: 初始部署

1. 访问 [Deno Deploy](https://dash.deno.com/)
2. 创建新项目
3. 连接您的 GitHub 仓库
4. 设置入口文件为 `main.ts`
5. 点击部署

**此时服务会成功启动，但显示需要配置状态**

### 步骤 2: 检查部署状态

访问您的部署URL根路径：
```bash
curl https://your-project.deno.dev/
```

**未配置时的响应：**
```json
{
  "message": "Gemini到OpenAI兼容API服务器",
  "version": "1.0.0",
  "status": "needs_configuration",
  "configuration": {
    "configured": false,
    "missingKeys": ["GEMINI_API_KEYS", "ACCESS_KEYS"],
    "instructions": "请在Deno Deploy环境变量中设置缺失的密钥"
  }
}
```

### 步骤 3: 配置环境变量

在 Deno Deploy 控制台中添加以下环境变量：

#### 🔑 必需的环境变量

```bash
# Gemini API 密钥（必需）
GEMINI_API_KEYS=your_gemini_api_key_1,your_gemini_api_key_2

# 准入密码（必需）
ACCESS_KEYS=your_access_password_1,your_access_password_2
```

#### ⚙️ 可选的环境变量（已有默认值）

```bash
PORT=8000
CORS_ORIGIN=*
LOG_LEVEL=info
MAX_RETRIES=3
REQUEST_TIMEOUT=30000
```

### 步骤 4: 验证配置

添加环境变量后，服务会自动重新部署。再次检查状态：

```bash
curl https://your-project.deno.dev/
```

**配置完成时的响应：**
```json
{
  "message": "Gemini到OpenAI兼容API服务器",
  "version": "1.0.0",
  "status": "ready",
  "configuration": {
    "configured": true,
    "missingKeys": [],
    "instructions": null
  }
}
```

## 🔐 获取密钥

### Gemini API 密钥

1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 创建新的 API 密钥
3. 复制密钥（格式：`AIzaSy...`）
4. 建议创建多个密钥实现负载均衡

### 准入密码

自定义强密码，用于控制 API 访问：
```bash
# 示例
ACCESS_KEYS=my_secret_key_123,another_key_456
```

## 🧪 测试部署

### 1. 测试模型列表

```bash
curl -H "Authorization: Bearer your_access_password" \
     https://your-project.deno.dev/v1/models
```

### 2. 测试聊天补全

```bash
curl -X POST https://your-project.deno.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_password" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 3. 测试图片识别

```bash
curl -X POST https://your-project.deno.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_access_password" \
  -d '{
    "model": "gemini-1.5-pro",
    "messages": [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "这是什么颜色？"},
          {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="}}
        ]
      }
    ]
  }'
```

## 📊 监控日志

在 Deno Deploy 控制台查看实时日志：

**配置完成的日志示例：**
```
✅ 已加载 2 个Gemini API密钥
✅ 已加载 2 个准入密码
✅ 服务器配置完整，可以正常使用
已获取 46 个可用的Gemini模型
```

**未配置的日志示例：**
```
⚠️  未配置Gemini API密钥 - 请在Deno Deploy中设置GEMINI_API_KEYS环境变量
⚠️  未配置准入密码 - 请在Deno Deploy中设置ACCESS_KEYS环境变量
⚠️  服务器配置不完整，需要设置以下环境变量:
   - GEMINI_API_KEYS
   - ACCESS_KEYS
💡 请在Deno Deploy控制台中添加缺失的环境变量
```

## 🔒 安全建议

1. **保护密钥**：
   - 使用强密码作为准入密码
   - 定期轮换 API 密钥
   - 不要在代码中硬编码密钥

2. **访问控制**：
   - 设置复杂的准入密码
   - 监控 API 使用情况
   - 考虑使用多个密码分发给不同用户

## 🆘 故障排除

### 常见问题

1. **服务启动但无法使用**
   - 检查环境变量是否正确设置
   - 访问根路径查看配置状态

2. **身份验证失败**
   ```json
   {
     "error": {
       "message": "服务器未配置准入密码。请在Deno Deploy环境变量中设置ACCESS_KEYS。",
       "type": "configuration_error"
     }
   }
   ```
   **解决方案**：在 Deno Deploy 中设置 `ACCESS_KEYS` 环境变量

3. **模型列表为空**
   ```json
   {
     "error": {
       "message": "服务器未配置Gemini API密钥。请在Deno Deploy环境变量中设置GEMINI_API_KEYS。",
       "type": "configuration_error"
     }
   }
   ```
   **解决方案**：在 Deno Deploy 中设置 `GEMINI_API_KEYS` 环境变量

### 检查清单

- [ ] 项目成功部署到 Deno Deploy
- [ ] 设置了 `GEMINI_API_KEYS` 环境变量
- [ ] 设置了 `ACCESS_KEYS` 环境变量
- [ ] 根路径返回 `"status": "ready"`
- [ ] 模型列表 API 正常工作
- [ ] 聊天补全 API 正常工作

## 🎉 部署完成

配置完成后，您的服务支持：

- ✅ OpenAI 兼容的聊天补全 API
- ✅ 图片识别（data URI 格式）
- ✅ 流式响应
- ✅ 自动密钥轮换和重试
- ✅ 详细的请求日志
- ✅ 友好的错误提示

**API 端点：**
- `GET /` - 服务状态和配置信息
- `GET /v1/models` - 获取可用模型列表
- `POST /v1/chat/completions` - 聊天补全（兼容 OpenAI 格式）

享受您的 Gemini 到 OpenAI 兼容 API 服务！🚀
