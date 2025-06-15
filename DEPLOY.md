# 🚀 Deno Deploy 部署教程

本教程将指导您如何将 Gemini API Proxy 部署到 Deno Deploy 平台。

## 📋 部署前准备

### 1. 获取 Gemini API 密钥
- 访问 [Google AI Studio](https://aistudio.google.com/)
- 登录您的 Google 账户
- 创建新的 API 密钥
- 保存密钥备用（格式：`AIzaSy...`）

### 2. 准备 GitHub 账户
- 确保您有 GitHub 账户
- 能够 Fork 公开仓库

## 🔧 详细部署步骤

### 步骤 1: Fork 项目

1. **访问项目仓库**
   - 打开项目的 GitHub 页面
   - 点击右上角的 **Fork** 按钮

2. **选择目标账户**
   - 选择您的 GitHub 账户
   - 等待 Fork 完成

3. **验证 Fork**
   - 确认项目已出现在您的仓库列表中
   - 记录仓库地址：`https://github.com/your-username/gemini-api-proxy`

### 步骤 2: 创建 Deno Deploy 项目

1. **访问 Deno Deploy**
   - 打开 [dash.deno.com](https://dash.deno.com/)
   - 使用 GitHub 账户登录

2. **创建新项目**
   - 点击 **New Project** 按钮
   - 选择 **Deploy from GitHub repository**

3. **选择仓库**
   - 在仓库列表中找到您 Fork 的项目
   - 点击项目名称选择

### 步骤 3: 配置部署设置

1. **基本配置**
   ```
   Repository: your-username/gemini-api-proxy
   Branch: main
   Entry Point: main.ts
   ```

2. **高级设置（可选）**
   - **Project Name**: 自定义项目名称
   - **Production Branch**: main
   - **Install Step**: 留空（Deno 自动处理依赖）

3. **开始部署**
   - 点击 **Deploy** 按钮
   - 等待初始部署完成（通常 1-2 分钟）

### 步骤 4: 配置环境变量

1. **进入项目设置**
   - 部署完成后，点击项目名称
   - 选择 **Settings** 标签页

2. **添加环境变量**
   - 找到 **Environment Variables** 部分
   - 点击 **Add Variable**

3. **设置必需变量**

   **变量 1: GEMINI_API_KEYS**
   ```
   Name: GEMINI_API_KEYS
   Value: AIzaSyAbc123...,AIzaSyDef456...
   ```
   > 💡 多个密钥用逗号分隔，提高可用性

   **变量 2: ACCESS_PASSWORDS**
   ```
   Name: ACCESS_PASSWORDS
   Value: sk-123456
   ```
   > 💡 这是您的 API 访问密码，客户端需要使用此密码

4. **保存配置**
   - 点击 **Save** 保存环境变量
   - 服务会自动重启并应用新配置

### 步骤 5: 验证部署

1. **获取服务地址**
   - 在项目概览页面找到您的域名
   - 格式：`https://your-project-name.deno.dev`

2. **测试 API 可用性**
   ```bash
   curl https://your-project-name.deno.dev/v1/models \
     -H "Authorization: Bearer sk-123456"
   ```

3. **测试聊天功能**
   ```bash
   curl -X POST https://your-project-name.deno.dev/v1/chat/completions \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer sk-123456" \
     -d '{
       "model": "gemini-1.5-flash",
       "messages": [
         {"role": "user", "content": "你好！"}
       ]
     }'
   ```

## 🔧 高级配置

### 自定义域名

1. **添加自定义域名**
   - 在项目设置中找到 **Domains** 部分
   - 点击 **Add Domain**
   - 输入您的域名

2. **配置 DNS**
   - 在您的域名提供商处添加 CNAME 记录
   - 指向 Deno Deploy 提供的地址

### 环境变量说明

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| `GEMINI_API_KEYS` | ✅ | Gemini API 密钥，多个用逗号分隔 | `AIzaSy...,AIzaSy...` |
| `ACCESS_PASSWORDS` | ✅ | API 访问密码 | `sk-123456` |
| `PORT` | ❌ | 服务端口（Deno Deploy 自动设置） | `8000` |
| `CORS_ORIGIN` | ❌ | CORS 允许的源 | `*` |

### 监控和日志

1. **查看部署日志**
   - 在项目页面选择 **Logs** 标签
   - 实时查看服务运行状态

2. **性能监控**
   - **Metrics** 标签显示请求统计
   - 监控响应时间和错误率

## 🛠️ 故障排除

### 常见问题

1. **部署失败**
   - 检查 `main.ts` 文件是否存在
   - 确认分支名称为 `main`
   - 查看部署日志中的错误信息

2. **API 密钥错误**
   - 验证 `GEMINI_API_KEYS` 格式正确
   - 确认密钥在 Google AI Studio 中有效
   - 检查密钥权限设置

3. **访问被拒绝**
   - 确认 `ACCESS_PASSWORDS` 设置正确
   - 检查请求头中的 Authorization 格式

4. **服务无响应**
   - 查看 Logs 标签中的错误信息
   - 确认环境变量已正确设置
   - 尝试重新部署项目

### 调试技巧

1. **查看实时日志**
   ```bash
   # 使用 curl 测试并观察日志
   curl -v https://your-project.deno.dev/v1/models \
     -H "Authorization: Bearer sk-123456"
   ```

2. **测试环境变量**
   - 在 Deno Deploy 控制台中检查环境变量
   - 确认没有多余的空格或特殊字符

## 🎉 部署完成

恭喜！您已成功将 Gemini API Proxy 部署到 Deno Deploy。

### 下一步

1. **配置客户端**
   - 使用您的 Deno Deploy URL 作为 API 端点
   - 使用设置的访问密码进行认证

2. **监控使用情况**
   - 定期查看 Deno Deploy 控制台
   - 监控 API 使用量和性能

3. **更新服务**
   - 当有新版本时，只需推送到 GitHub
   - Deno Deploy 会自动重新部署

### 支持

如果遇到问题，请：
- 查看项目 README 文档
- 在 GitHub Issues 中报告问题
- 提供详细的错误日志和配置信息

---

**🚀 享受您的 Gemini API 代理服务！**
