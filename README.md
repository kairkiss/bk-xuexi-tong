# BK 学习通桌面助手

> 面向 macOS 的学习通 / 超星本地课程任务运行器。把原本需要守着网页、盯着终端、反复点来点去的课程流程，收进一个更像产品的桌面 App 里。

**BK 学习通桌面助手** 基于 `Samueli924/chaoxing` 的 Python core 封装而来，目标很直接：让学习通 / 超星课程任务从“脚本能跑”变成“普通人也能点开就用”。

它不是网页插件，不是云端代挂平台，也不是题库工具。它只在你的 Mac 本机运行，把课程列表、运行状态、倍率、并发、日志和诊断做成一个清晰的桌面控制台。

当前版本：**v1.0.0**

---

## 这是什么？

这是一个给学习通 / 超星用户准备的 **macOS 本地课程任务 App**。

如果你已经受够了这些场景：

- 网页开着一堆标签页，课程进度却不知道卡在哪里；
- 终端脚本能跑，但黑窗口对普通用户不友好；
- 课程很多，手动切换、筛选、查看进度很麻烦；
- 出错后不知道是登录问题、环境问题，还是 core 依赖问题；
- 想把学习通 / 超星自动化流程做成一个真正能交付的桌面产品；

那这个项目就是为这个方向做的。

**一句话：它把学习通 / 超星课程任务变成一个本地、可视化、可诊断、可打包分发的 macOS App。**

---

## 核心卖点

### 1. 本地运行，不走云端

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

### 3. 更像产品，而不是脚本

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

## 它不做什么

为了让项目边界清楚，这些能力不会作为本项目目标：

- 不提供考试功能；
- 不提供自动答题入口；
- 不集成题库平台；
- 不帮你绕过学校或课程平台规则；
- 不提供云端代跑、代学、账号托管服务；
- 不收集、不上传、不出售用户账号、密码或 Cookie。

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
| Apple Silicon 原生包 | 待完善 |
| Developer ID 签名 | 待完善 |
| Notarization | 待完善 |
| Windows / Android | 暂不支持 |

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

## 后续计划

- 构建 Apple Silicon / Universal 版本；
- 补齐 Developer ID 签名；
- 补齐 macOS notarization；
- 增加 GitHub Actions 自动构建；
- 优化首次打开引导；
- 增加更友好的错误提示；
- 增加 release 安装说明截图。

---

## License

本项目使用 **GPL-3.0** 开源。

上游 Python core 来自 `Samueli924/chaoxing`，同样遵循其原始开源许可证。
