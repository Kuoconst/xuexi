<div align="center">

<br>

# 🤝 贡献指南

**感谢你对 Xuexitong Insight 项目的关注！**

<br>

我们欢迎各种形式的贡献，包括但不限于：提交 Bug 报告、功能建议、代码改进、文档完善等。

在开始贡献之前，请仔细阅读以下指南。

<br>

</div>

---

## ⚠️ 行为准则

参与本项目即表示你同意：

- 尊重他人，保持友善和专业的沟通态度
- 接受建设性的批评和反馈
- 以社区整体利益为重
- **不得利用本项目从事自动化学习刷课等违反平台规则、学术诚信或法律法规的行为**

---

## 📝 如何贡献

### 🐛 1. 提交 Bug 报告

如果你发现了 Bug，请通过 [Issues](../../issues) 提交报告，并包含以下信息：

- **标题** — 简洁描述问题
- **环境信息** — 浏览器版本、操作系统、插件版本
- **复现步骤** — 详细描述如何复现问题
- **预期行为** — 你认为应该发生什么
- **实际行为** — 实际发生了什么
- **日志** — 如可能，请附上导出的运行日志（高级选项 → 导出运行日志）
- **截图** — 如适用，附上截图帮助说明问题

> [!TIP]
> 提交前请先搜索已有 Issue，避免重复报告。

### 💡 2. 提出功能建议

欢迎提出新功能或改进建议，请在 [Issues](../../issues) 中创建，并说明：

- **功能描述** — 你希望实现什么
- **使用场景** — 这个功能解决什么技术问题
- **实现思路** — 如果你有想法，可以简要描述

### 💻 3. 贡献代码

#### 开发流程

1. **Fork 本仓库**到你的 GitHub 账号

2. **克隆你的 Fork** 到本地
   ```bash
   git clone https://github.com/Kuoconst/xuexitong.git
   cd xuexitong
   ```

3. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或修复分支
   git checkout -b fix/your-fix-name
   ```

4. **进行开发**，遵循下方的代码规范

5. **本地测试** — 在浏览器中加载扩展，验证功能正常

6. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 简要描述你的更改"
   ```

7. **推送到你的 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **提交 Pull Request** 到本仓库的 `main` 分支

#### Pull Request 要求

- **标题** — 使用约定式提交格式（见下方）
- **描述** — 说明更改内容、原因和影响范围
- **关联 Issue** — 如修复了某个 Issue，请注明 `Fixes #123`
- **测试** — 说明你如何验证更改的正确性
- **截图/录屏** — 如涉及 UI 变更，请附上截图

#### 约定式提交规范

Commit 信息请遵循以下格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型：**

- `feat` — 新功能
- `fix` — Bug 修复
- `docs` — 文档变更
- `style` — 代码格式（不影响功能）
- `refactor` — 重构（既不是新功能也不是修复）
- `perf` — 性能优化
- `test` — 测试相关
- `chore` — 构建/工具/依赖相关

**示例：**
```
feat(form): 支持多行文本字段的富文本填充

- 适配 UEditor 富文本编辑器
- 处理换行符转换

Fixes #42
```

---

## 📏 代码规范

### JavaScript 规范

- 使用 **ES6+** 语法（`const`/`let`、箭头函数、模板字符串、解构赋值等）
- 使用 **类（class）** 封装核心模块，保持面向对象设计
- 缩进使用 **4 个空格**
- 字符串优先使用单引号 `'`
- 语句末尾使用分号 `;`
- 变量和函数使用 **小驼峰命名**（`camelCase`）
- 类名使用 **大驼峰命名**（`PascalCase`）
- 常量使用 **全大写下划线分隔**（`UPPER_SNAKE_CASE`）
- 文件命名与导出的类名一致（如 `AIClient.js` 导出 `AIClient` 类）

### 模块设计原则

- **单一职责** — 每个模块/类只负责一件事
- **模块化** — 新功能优先添加为独立模块，而非修改现有模块
- **可配置** — 硬编码的数值、选择器等应提取到 `constants/` 目录
- **向后兼容** — 修改公共接口时需考虑兼容性

### CSS 选择器管理

- 所有学习通页面相关的 CSS 选择器统一放在 `src/constants/selectors.js`
- 不要在业务代码中硬编码选择器
- 页面结构变化时，只需修改此文件

### 注释规范

- 公共类和方法必须有 JSDoc 注释
- 复杂逻辑需添加行内注释说明原因
- 注释使用中文

---

## 🏗️ 项目架构速览

在贡献代码前，建议了解项目的核心架构：

```
xuexitong/
├── manifest.json              # 插件配置文件 (Manifest V3)
├── background.js              # 后台 Service Worker（API 请求中转、日志汇聚）
├── src/
│   ├── constants/             # 常量定义
│   │   ├── selectors.js       # CSS 选择器集中管理（学习通页面适配）
│   │   ├── types.js           # 字段类型枚举与关键词映射
│   │   └── config.js          # 默认配置（超时、重试、间隔等）
│   ├── modules/               # 核心业务类
│   │   ├── FontDecryptor.js   # 加密字体解密研究
│   │   ├── QuestionDetector.js # 表单字段检测与内容提取
│   │   ├── AIClient.js        # LLM API 调用封装
│   │   ├── AnswerFiller.js    # 表单内容填充（策略模式）
│   │   ├── CoursePlayer.js    # 章节遍历与多媒体控制
│   │   └── MessageBus.js      # 消息通信总线
│   ├── utils/                 # 工具函数
│   │   ├── dom.js             # DOM 操作、富文本编辑器交互
│   │   ├── iframe.js          # iframe 递归搜索
│   │   ├── sleep.js           # 延迟工具
│   │   ├── api.js             # API 请求封装
│   │   └── log.js             # 日志系统
│   └── main.js                # 入口文件（总控制器）
├── panel/
│   └── float-panel.js         # 悬浮控制面板 UI 与交互
├── assets/
│   ├── TyprMd5.js             # 字体解析库
│   └── table.json             # 字体解密映射表
├── README.md                  # 项目主文档
├── CONTRIBUTING.md            # 贡献指南（本文档）
└── LICENSE                    # 开源协议
```

**核心模块说明：**

- **`background.js`** — Service Worker，API 请求中转 + 日志汇聚
- **`src/main.js`** — 入口，总控制器
- **`src/modules/`** — 核心业务类（FontDecryptor, AIClient, AnswerFiller, CoursePlayer 等）
- **`src/utils/`** — 工具函数（dom, iframe, log 等）
- **`src/constants/`** — 常量（selectors, types, config）
- **`panel/float-panel.js`** — 悬浮控制面板 UI

**通信方式：**

- content script ↔ background：`chrome.runtime.sendMessage`
- content script ↔ 悬浮窗：`window.postMessage`

---

## 🔧 本地开发与调试

### 加载开发版本

1. 打开 <kbd>chrome://extensions/</kbd> 或 <kbd>edge://extensions/</kbd>
2. 开启「开发人员模式」
3. 点击「加载解压缩的扩展」，选择项目中的扩展文件夹
4. 修改代码后，点击扩展卡片上的「刷新」按钮重新加载

### 查看日志

- **Content Script 日志** — 在学习通页面按 <kbd>F12</kbd>，查看 Console
- **Background 日志** — 在扩展管理页面点击扩展的「Service Worker」链接
- **运行日志** — 悬浮窗 → 配置 → 高级选项 → 导出运行日志

### 调试命令

```javascript
// 查看运行实例状态
window.XuexitongBot.bot

// 查看详细日志
chrome.storage.local.get(['xbDetailLogs'], (r) => console.log(r.xbDetailLogs));
```

---

## 📖 文档贡献

文档同样重要！如果你发现文档有错误、过时或不够清晰，欢迎提交 PR 改进：

- 修正错别字和语法错误
- 补充缺失的说明
- 优化排版和结构
- 添加使用示例和截图

---

## ❓ 常见问题

**Q: 我的 PR 多久会被审核？**

我们会尽快审核所有 PR，通常在 1-3 个工作日内回复。如果超过一周未收到回复，可以在 PR 中留言提醒。

**Q: 可以添加新的 AI 提供商支持吗？**

可以！请参考 README 中的「添加新的 API 提供商」部分，确保不破坏现有功能。

**Q: 可以适配其他类型的网站吗？**

本项目以学习通（超星）平台为主要研究对象，聚焦多层 iframe 嵌套页面的自动化技术。如果你希望适配其他类型的网站，建议基于本项目的架构创建独立的 Fork 或新项目。

---

## 🙏 致谢

感谢每一位为这个项目做出贡献的人！你的努力让这个项目变得更好。

---

<div align="center">

如有其他疑问，欢迎通过 [Issues](../../issues) 联系我们

</div>