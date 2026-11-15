# Mantle · 定位与打包约定

> 2026-11-15 定稿。这个仓库只产出浏览器本体，不再包含面板、启动器或账号界面。

## 定位

- 一个随包携带 fingerprint-chromium 的 macOS 应用，品牌名「Mantle」。
- 没有自己的首页、设置页或登录入口。启动参数、时区、资料目录全部由调用方（Matou）传入。
- Matou 负责：打开登录页、管理常驻与临时资料、决定时区和指纹种子、出口检测、安装与更新引导。

## 品牌

| 项 | 值 |
|---|---|
| 显示名 | Mantle |
| Bundle ID | `dev.matou.mantle` |
| 版本 | `148.0.7778.215`（与内核一致） |
| 可执行文件 | `Contents/MacOS/Chromium`（不改名，避免内核内部路径问题） |
| 图标 | `build/icon.icns` |

## 产物

- `dist/Mantle.app`
- `dist/Mantle-148.0.7778.215-arm64.dmg`

## 调用约定

由 Matou 直接 spawn `Contents/MacOS/Chromium`，典型参数：

```
--user-data-dir=<资料目录>
--timezone=<IANA 时区>
--accept-lang=zh-CN,zh
--fingerprint=<固定种子>
--fingerprint-platform=macos
--no-first-run
--no-default-browser-check
--remote-debugging-pipe
<要打开的地址>
```

## 分发

- GitHub 公开 Release，源码公开。
- ad-hoc 签名，不公证。
- 从浏览器手动下载会被 Gatekeeper 拦一次，需要右键打开；由 Matou 程序化下载安装通常不会带隔离标记。

## 不做

- 不做面板、账号、设置、自动更新、遥测。
- 不改系统时区、语言、代理。
- 不内置代理。
