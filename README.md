# bk学习捅

bk学习捅 是一个 macOS 本地学习任务管理工具，把 `Samueli924/chaoxing` 的 Python CLI 封装成桌面应用。

当前版本：v1.0.0

## 边界

- 只面向 macOS。
- 不包含自动答题、题库、考试相关功能入口。
- 不做云同步、自动更新或联网检查。
- 不会把账号、密码、Cookie 上传到远程服务器。
- 用户配置保存在本机：`~/Library/Application Support/bk学习捅/`。

## License

本项目使用 GPL-3.0 开源。上游 Python core 来自 `Samueli924/chaoxing`，同样遵循其原始开源许可证。

## 下载即用策略

打包版会优先使用 App 内置的 Python 3.13 和 Python 依赖，不要求用户手动安装 `brew`、`uv` 或 Python。

当前本机产物是 x86_64 未签名包。Apple Silicon 机器需要 Rosetta 才能直接运行该 x86_64 包；真正面向任意 Mac 分发，还需要补齐 universal 构建、Developer ID 签名和 notarization。

## 开发运行

```bash
brew install uv
uv python install 3.13
npm install
npm run setup:core
npm run dev
```

## 常用命令

```bash
npm run check
npm run setup:core
npm run apply:core-patches
npm run prepare:runtime
npm run dev
npm run build:mac
```

`npm run build:mac` 会先准备轻量运行时，再使用 `CSC_IDENTITY_AUTO_DISCOVERY=false` 打未签名 macOS 包。

## 上游 core

仓库不直接提交 `core/chaoxing`，避免把第三方仓库和本地虚拟环境塞进项目历史。

`npm run setup:core` 会克隆 `Samueli924/chaoxing` 的固定提交，并应用 `patches/` 里的本项目补丁。

## Release

`v1.0.0` 的 GitHub Release 附带 macOS `.app` 压缩包。源码仓库不提交二进制运行时、Electron 构建产物、日志或本机用户配置。
