<div align="center">

<br>

# ⛔ 重要声明

### 本项目仅供技术研究与学习交流使用

#### 严禁用于自动化学习刷课、自动答题等任何违反平台规则和学术诚信的行为

<br>

---

<br>

# 📚 Xuexitong Insight

**学习页面自动化技术研究 · 浏览器扩展**

<br>

[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge-green.svg?style=for-the-badge)](#)
[![Manifest](https://img.shields.io/badge/Manifest-V3-orange.svg?style=for-the-badge)](#)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg?style=for-the-badge)](#)

<br>

基于 Chrome Extension Manifest V3 的前端自动化技术研究项目，以学习通平台为研究对象，探索多层 iframe 嵌套页面的元素定位、加密字体解析、表单智能填充与多媒体播放控制等技术方向。

<br>

[✨ 研究内容](#-研究内容) · [🚀 安装方法](#-安装方法) · [📖 使用说明](#-使用说明) · [⚙️ 配置说明](#️-配置说明) · [🔧 开发指南](#-开发指南) · [🤝 贡献指南](CONTRIBUTING.md)

<br>

</div>

---

## ⚠️ 免责声明

> [!WARNING]
> 本项目仅供**学习交流和技术研究**使用，旨在探索浏览器扩展开发、iframe 嵌套处理、字体加密解密、AI API 集成和前端自动化等技术方向。
>
> **严禁用于自动化学习刷课、自动答题等任何违反平台规则和学术诚信的行为。** 所有研究成果仅用于技术验证，使用者应自行遵守学习通（超星）平台的用户协议及所在机构的规章制度。

> [!CAUTION]
> 使用本软件可能导致的风险包括但不限于：
> - 学习进度被清零
> - 账号被封禁或限制登录
> - 课程成绩作废
> - 受到学校纪律处分
>
> 开发者不对因使用本软件而导致的任何直接或间接损失负责，一切后果由使用者自行承担。

> [!NOTE]
> 本项目集成的大语言模型（LLM）生成内容仅作参考，可能存在不准确、不完整、过时或错误的情况，包括但不限于答案错误、事实偏差、逻辑漏洞等。开发者不对 AI 生成内容的准确性、完整性或可靠性做任何保证，使用者应自行判断和验证生成内容的正确性，因依赖 AI 生成内容而导致的任何后果由使用者自行承担。

---

## ✨ 研究内容

### 🤖 表单智能填充

- **多类型字段识别** — 支持单选、多选、判断、填空、简答等常见表单字段的结构化提取
- **AI 辅助内容生成** — 集成 DeepSeek 和 OpenAI 兼容接口，基于字段上下文生成填充内容
- **字段类型自动检测** — 自动识别表单字段类型并提取题干文本
- **加密字体解析** — 针对学习通自定义字体加密（`.font-cxsecret`）的解密还原研究
- **自动提交验证** — 填充完成后可自动保存并提交表单
- **推理强度调节** — 支持 none / low / high / max 四档 AI 推理强度

### 📺 多媒体与页面遍历

- **视频播放控制** — 支持 1x / 1.25x / 1.5x / 2x 倍速播放，研究 HTML5 Video API 的自动化控制
- **文档页面滚动** — 自动滚动文档区域至底部，模拟阅读行为
- **章节节点遍历** — 自动解析学习通目录树并逐节点跳转处理
- **已处理节点跳过** — 可跳过已标记完成的任务节点
- **嵌套任务处理** — 遍历过程中遇到表单类任务自动调用填充模块
- **进度拖拽研究** — 探索视频进度条直接定位的技术可行性

### 🔧 核心技术

- **原生 JavaScript** — 无框架依赖，轻量高效
- **模块化架构** — 功能拆分为独立类，职责单一
- **跨域安全中转** — 通过 background service worker 代理 API 请求
- **iframe 递归搜索** — 深度达 10 层，适配学习通复杂多层嵌套页面结构
- **双通道通信** — `chrome.runtime.sendMessage` + `window.postMessage`
- **完善日志系统** — 会话级显示日志 + 持久化详细日志，支持导出

---

## 🚀 安装方法

### Chrome / Edge 浏览器

1. **下载或克隆本仓库**
   ```bash
   git clone https://github.com/Kuoconst/xuexitong.git
   ```

2. **打开浏览器扩展管理页面**
   - Chrome：地址栏输入 <kbd>chrome://extensions/</kbd>
   - Edge：地址栏输入 <kbd>edge://extensions/</kbd>

3. **开启右上角的「开发人员模式」**

4. **点击「加载解压缩的扩展」**

5. **选择项目中的扩展文件夹**

6. **安装完成**，打开学习通页面即可看到悬浮控制面板

> 💡 其他基于 Chromium 的浏览器（如 Brave、360 极速浏览器等）操作类似。

---

## 📖 使用说明

### 表单处理模式

1. 进入学习通包含表单的研究页面
2. 点击悬浮窗的「配置」按钮，设置 AI API
3. 点击「开始处理」，扩展将自动识别表单字段并调用 AI 生成填充内容
4. 处理过程中可随时点击「停止」中断

### 章节遍历模式

1. 进入学习通课程学习页面（章节列表页）
2. 点击按钮开始自动逐节点处理
3. 扩展会自动遍历章节，处理视频、文档、表单等各类任务节点
4. 支持暂停和恢复

---

## ⚙️ 配置说明

### API 配置

扩展支持两种 API 模式，在悬浮窗「配置」中设置。

**DeepSeek（默认）**

- **API Key** — 你的 DeepSeek API Key
- **模型** — 点击「获取模型」自动拉取可用模型列表

**OpenAI 兼容接口**

开启「使用 OpenAI 兼容接口」开关后可配置：

- **接口地址** — OpenAI 格式的 API 端点，例如 `https://api.openai.com/v1`
- **API Key** — 对应接口的密钥
- **模型** — 点击「获取模型」拉取或手动输入

> 💡 支持任何兼容 OpenAI API 格式的服务，包括但不限于：OpenAI 官方、DeepSeek、各类第三方代理和本地部署模型（如 Ollama + OpenAI 兼容层）。

### 表单处理设置

- **处理间隔** — 默认 5 秒，每个字段之间的等待时间（0-10 秒）
- **覆盖已有内容** — 默认关闭，开启后覆盖已填充内容，关闭则跳过
- **随机填充** — 默认关闭，AI 响应失败时随机填入内容
- **自动提交** — 默认关闭，处理完成后自动提交表单
- **思考等级** — 默认 low，AI 推理强度可选 none / low / high / max

### 播放与遍历设置

- **视频倍速** — 默认 1x，可选 1x / 1.25x / 1.5x / 2x
- **自动下一节点** — 默认开启，当前节点处理完成后自动切换
- **跳过已完成** — 默认开启，跳过已标记完成的任务节点

---

## 🔧 开发指南

### 环境要求

- Chrome / Edge 浏览器（支持 Manifest V3）
- 文本编辑器（推荐 VS Code）
- 无需构建工具，原生 JavaScript 直接运行

### 本地调试

1. 按安装方法加载扩展
2. 修改代码后，在扩展管理页面点击扩展卡片上的「刷新」按钮
3. 学习通页面按 <kbd>F12</kbd> 打开开发者工具查看 content script 日志
4. 在扩展管理页面点击「Service Worker」查看 background 日志

### 调试技巧

```javascript
// 在浏览器控制台查看运行状态
window.XuexitongBot.bot

// 查看会话级显示日志（上限 500 条，刷新保留、关浏览器清空）
chrome.storage.session.get(['xbDisplayLogs'], (r) => console.log(r.xbDisplayLogs));

// 查看持久化详细日志（上限 1000 条）
chrome.storage.local.get(['xbDetailLogs'], (r) => console.log(r.xbDetailLogs));
```

### 扩展表单字段类型

1. 在 `src/constants/types.js` 的 `KEYWORDS` 中添加新字段类型关键词
2. 在 `src/modules/AIClient.js` 的 `buildPrompt()` 中添加对应 prompt 模板
3. 在 `src/modules/AnswerFiller.js` 的 `_strategies` 中添加填充策略
4. 在 `src/modules/QuestionDetector.js` 的 `detectQuestionType()` 中添加检测逻辑

### 适配学习通页面更新

学习通页面 DOM 结构变化时，通常只需修改 `src/constants/selectors.js` 中的 CSS 选择器，无需改动业务逻辑。

### 添加新的 API 提供商

1. 在 `panel/float-panel.js` 中添加 UI 选项
2. 在 `background.js` 的 `handleApiCall()` 中添加 URL 构建逻辑
3. 如需特殊 prompt 处理，在 `src/modules/AIClient.js` 中适配

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request，请阅读 [贡献指南](CONTRIBUTING.md) 了解详情。

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

## 🔗 第三方开源组件

- **Typr.js** (MIT) — https://github.com/photopea/Typr.js
- **blueimp‑md5** v2.19.0 (MIT) — https://github.com/blueimp/JavaScript‑MD5

> 注：`TyprMd5.js` 是上述库经 jsDelivr 合并压缩后的单文件分发版本，无独立开源仓库，文件内原有版权注释完整保留未修改。

---

<div align="center">

<br>

如果这个项目对你的技术研究有帮助，欢迎给个 ⭐ Star 支持

<br>

<sub>Made with ❤️ for research purposes only</sub>

<br>

</div>
