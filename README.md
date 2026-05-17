# BK Chaoxing Desktop 超星学习通刷课 app 

> 学习通 / 超星课程任务桌面助手。第一版从 macOS 起步，目标是逐步补齐 Windows、Linux，做成真正跨平台、可视化、本地运行的学习通 / 超星刷课刷题桌面 App。

**BK Chaoxing Desktop** 基于Python core 封装而来，第一阶段先把原本偏脚本化、终端化的课程任务流程做成 macOS 桌面应用；后续会继续扩展到 Windows 和 Linux，并加入 AI 学习辅助刷题能力。

它不是网页插件，不是云端托管平台，也不是考试工具。它的目标是把课程列表、运行状态、倍率、并发、日志、诊断和后续 AI 辅助能力，统一收进一个更像正式产品的桌面控制台里。

当前版本：**v1.0.0 / macOS 第一版**

---

## 项目定位

这是一个面向学习通 / 超星场景的 **本地桌面刷课刷题任务 App**。

如果你已经受够了这些体验：

- 没必要的水课程布置太多网课，毫无意义；
- 老师打开了不允许快进，还必须把网页放在前台；
- 传统终端/浏览器/油猴脚本能跑，但黑窗口对普通用户不友好；
- 课程很多，手动切换、筛选、查看状态很麻烦；
- 出错后不知道是登录问题、环境问题，还是 Python core 依赖问题；
- 想把学习通 / 超星刷课自动化流程做成一个真正能交付、能分发、能迭代的桌面产品；
- 想在未来加入 AI 帮你做题，而不是只停留在“能跑脚本”；

那这个项目就是为这个方向准备的。

**一句话：BK Chaoxing Desktop 要把学习通 / 超星从网页和脚本里解放出来，变成一个本地、可视化、可诊断、可扩展的桌面刷课 App。**

---

## 当前第一版能做什么

### 1. 本地运行

账号、密码、Cookie、配置和日志都保存在本机目录：

```text
~/Library/Application Support/bk学习捅/
```

不做云同步，不上传账号，不把 Cookie 交给第三方服务器。

### 2. 图形化课程控制台

不再只靠终端黑窗口。

App 内可以完成：

- 账号密码登录；
- Cookie 登录；
- 获取课程列表；
- 搜索课程；
- 多选课程；
- 设置加速倍率；
- 设置并发章节；
- 启动 / 停止任务；
- 查看课程进度、章节进度、当前任务和最近事件。

### 3. 产品化封装

它不是把 Python 命令粗暴塞进 Electron，而是做了完整的桌面化封装：

- Electron + React + TypeScript 前端；
- Electron 主进程托管 Python runner；
- preload 暴露最小 IPC API；
- 打包版优先使用 App 内置 Python 3.13；
- 支持环境检查；
- 支持导出脱敏日志；
- 支持固定上游 core 提交并应用本项目 patch。

### 4. 下载即用路线

打包版会优先使用 App 内置的 Python 3.13 和 Python 依赖，目标是不要求普通用户手动安装 `brew`、`uv` 或 Python。

当前阶段的 release 仍是技术预览：本机产物为 **x86_64 未签名 macOS 包**。Apple Silicon 机器需要 Rosetta 才能直接运行该 x86_64 包。

---

## 未来路线图

BK Chaoxing Desktop 不会停留在 macOS 第一版。后续目标是做成一个完整的跨平台学习通 / 超星桌面产品。

### 阶段 1：macOS 可用版

当前版本属于这个阶段。

目标：

- 完成 macOS 桌面 UI；
- 完成本地运行；
- 完成课程列表获取；
- 完成课程多选；
- 完成运行状态看板；
- 完成环境诊断；
- 完成日志导出；
- 完成内置 Python runtime 打包。

### 阶段 2：macOS 正式分发版

下一步优先把 macOS 版本做稳。

计划：

- Apple Silicon / Intel 双架构支持；
- Universal 构建；
- Developer ID 签名；
- macOS notarization；
- 更完整的 release 安装说明；
- 更友好的首次启动引导；
- 更清楚的错误提示。

### 阶段 3：Windows 版

后续补齐 Windows 桌面版。

计划：

- Windows 打包；
- Windows 内置 Python runtime；
- Windows 日志目录适配；
- Windows 环境诊断；
- Windows 安装包或便携版分发；
- 统一 UI 和运行逻辑。

### 阶段 4：Linux 版

再补齐 Linux 桌面版。

计划：

- Linux AppImage / deb / rpm 分发；
- Linux Python runtime 适配；
- Linux 日志目录适配；
- Linux 桌面环境兼容；
- 与 macOS / Windows 共用同一套核心 UI 和任务逻辑。

### 阶段 5：AI 学习辅助

AI 能力会作为后续高级模块加入。

计划方向：

- 题目解析；
- 知识点讲解；
- 错题复盘；
- 相似题训练；
- 学习报告总结；
- 课程内容问答；
- 本地题目记录与检索；
- 可配置的 AI provider，例如 OpenAI 兼容接口、本地模型或其他第三方模型。

AI 模块的目标不是考试作弊工具，也不是云端代答平台。它会更偏向 **学习辅助、解析、复盘和练习**，帮助用户理解题目和知识点，而不是替用户在考试或受监管测验中自动提交答案。

---

## 它不做什么

为了让项目边界清楚，这些能力不会作为本项目目标：

- 不提供正规线上考试的ai自动提交（这有违初衷，我们是解决毫无意义的事，而不是创造毫无意义的人）；
- 不提供受监管考试场景的自动答题（原因同上）；
- 不做云端代跑、代学、账号托管服务（一切在你设备本地运行，后果你自己承担）；
- 不收集、不上传、不出售用户账号、密码或 Cookie（代码已开源，不会上传你的机密）。

请只在你拥有合法使用权限的本人账号、本人课程中使用，并自行遵守学校、课程平台和相关服务条款。

---

## 普通用户怎么用

### 1. 下载 App

前往 GitHub Release 下载 `v1.0.0` 的 macOS `.app` 压缩包。

### 2. 解压并打开

如果 macOS 提示“无法验证开发者”或“已损坏”，这是因为当前包还没有 Developer ID 签名和 notarization。

可以尝试：

1. 打开“系统设置”；
2. 进入“隐私与安全性”；
3. 找到被拦截的 App；
4. 点击“仍要打开”。

也可以右键 App，选择“打开”，再确认运行。

### 3. 登录

App 支持两种方式：

- 账号密码登录；
- Cookie 登录。

密码和 Cookie 默认不保存到前端 localStorage；运行时会写入本机 App Support 目录，用于调用本地 Python core。

### 4. 获取课程

填写登录信息后，点击 **获取课程**。

获取成功后，可以搜索课程名或课程 ID，并选择要运行的课程。

### 5. 设置运行参数

可配置：

- 加速倍率：1x / 2x / 4x / 6x / 8x；
- 并发章节：1 到 6。

建议先从 **2x 或 4x** 开始。如果课程频繁重试，降低倍率或并发。

### 6. 开始运行

选择课程后点击 **开始运行**。

右侧面板会显示：

- 当前课程；
- 当前章节；
- 当前任务；
- 课程进度；
- 章节任务进度；
- 最近事件。

### 7. 出错时怎么处理

先点击 **检查环境**。

如果仍然异常，点击 **导出日志**。日志会导出到桌面，里面包含：

- `app.log`；
- `raw.log`；
- `diagnostics.txt`；
- `config.redacted.ini`。

导出的配置文件会尽量脱敏账号密钥类字段，便于排查问题。

---

## 当前状态

| 项目 | 状态 |
| --- | --- |
| macOS 桌面 UI | 已完成基础版 |
| 获取课程列表 | 已支持 |
| 多选课程 | 已支持 |
| 加速倍率 | 已支持，1x 到 8x |
| 并发章节 | 已支持，1 到 6 |
| 运行状态看板 | 已支持 |
| 环境检查 | 已支持 |
| 日志导出 | 已支持 |
| 内置 Python 运行时 | 已支持 |
| Apple Silicon 原生包 | 计划中 |
| Windows 版 | 计划中 |
| Linux 版 | 计划中 |
| AI 学习辅助 | 计划中 |
| Developer ID 签名 | 待完善 |
| Notarization | 待完善 |

---

## 开发运行

### 依赖

开发环境需要：

- Node.js；
- npm；
- uv；
- Python 3.13。

### 初始化

```bash
brew install uv
uv python install 3.13
npm install
npm run setup:core
npm run dev
```

### 常用命令

```bash
npm run check
npm run setup:core
npm run apply:core-patches
npm run prepare:runtime
npm run dev
npm run build:mac
```

`npm run build:mac` 会先准备轻量运行时，再使用 `CSC_IDENTITY_AUTO_DISCOVERY=false` 打未签名 macOS 包。

---

## 项目结构

```text
.
├── electron/              # Electron 主进程、preload、Python runner
├── src/                   # React 前端界面
├── scripts/               # core 初始化、patch、环境检查、运行时准备脚本
├── patches/               # 针对上游 chaoxing core 的补丁
├── assets/                # 图标资源
├── build/                 # 本地构建运行时目录，不提交二进制产物
└── release/               # electron-builder 输出目录
```

---

## 上游 core

仓库不直接提交 `core/chaoxing`，避免把第三方仓库和本地虚拟环境塞进项目历史。

`npm run setup:core` 会克隆 `Samueli924/chaoxing` 的固定提交，并应用 `patches/` 里的本项目补丁。

---

## Release 策略

`v1.0.0` 的 GitHub Release 附带 macOS `.app` 压缩包。

源码仓库不提交：

- 二进制运行时；
- Electron 构建产物；
- 用户日志；
- 本机用户配置；
- 账号、密码、Cookie。

---

## 推荐仓库名

当前仓库名是：

```text
bk-xuexi-tong
```

如果后续要做跨平台正式产品，更推荐改成：

```text
bk-chaoxing-desktop
```

这个名字更清楚：

- `bk`：保留你的个人标识；
- `chaoxing`：明确学习通 / 超星场景；
- `desktop`：明确桌面端、跨平台方向。

---

## License

本项目使用 **GPL-3.0** 开源。

上游 Python core 来自 `Samueli924/chaoxing`，同样遵循其原始开源许可证。
