# DeepSeek Agent 📱

一个可自主配置 API 的 AI 聊天 Agent App,支持**通用 OpenAI 兼容接口**(DeepSeek 官方 / 中转站 / 第三方均可),打包成 Android APK 直接安装到手机。

## 功能
- 🔑 **自主配置**:base URL、API Key、模型名、温度、系统提示词、max_tokens,全部可填
- ⚡ **流式对话**:逐字输出,支持 DeepSeek-R1 的思考过程(reasoning_content)折叠显示
- 💬 **多会话**:新建 / 切换 / 删除,自动生成标题
- 🌗 **主题**:浅色 / 深色 / 跟随系统
- 📝 **Markdown**:渲染 + 代码高亮 + 一键复制
- ⬇️ **导出**:单会话 / 全部导出为 Markdown 文件
- 🎤 **语音输入**(取决于设备语音服务)
- 🔒 **数据本地存储**:API Key 只存手机本地,不经过任何中间服务器

## 本地预览(网页版)
```bash
npm install
npx serve www        # 或用任意静态服务器打开 www/
```
浏览器打开后,点击右上角 ⚙ 填入 DeepSeek 配置即可使用。

## 打包 APK(云构建)
1. 把本项目推送到 GitHub 仓库
2. 进入仓库 **Actions** 页面 → 选择 **Build APK** 工作流 → **Run workflow**
3. 构建完成后,在 Actions 运行详情底部下载 **deepseek-agent-apk** 产物

## 手机安装
1. 把下载的 `app-debug.apk` 传到红米手机(微信/QQ/数据线/网盘均可)
2. 点击 APK → 若提示"未知来源",允许该文件管理器/浏览器的**安装未知应用**权限
3. 安装后打开,进入 ⚙ 设置,填入 DeepSeek 配置(官方:`https://api.deepseek.com` + `deepseek-chat`)
4. 开始对话

## 技术栈
原生 HTML/CSS/JS + [Capacitor](https://capacitorjs.com) + GitHub Actions 云构建。
