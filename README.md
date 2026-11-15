# Mantle

macOS arm64 的登录专用浏览器：随包携带 fingerprint-chromium 148，固定时区、中文界面、跟随系统出口。没有自己的界面，由 Matou 启动并传入参数。

## 构建

```sh
# 1. 准备内核（首次，约 134MB）
node scripts/fetch-chromium.mjs
# 或者从已有的 Chromium.app 复制
node scripts/fetch-chromium.mjs --from /path/to/Chromium.app

# 2. 打包出 dist/Mantle.app 与 DMG
node scripts/package.mjs
# 只生成 app，跳过 DMG
node scripts/package.mjs --skip-dmg
```

产物为 `dist/Mantle.app` 和 `dist/Mantle-148.0.7778.215-arm64.dmg`。
脚本会替换显示名和图标、禁用上游更新器配置（如存在）、对 app 做 ad-hoc 深签并严格验证。
DMG 使用 UDZO 压缩，包含应用和 `/Applications` 链接；生成后自动只读挂载，
检查应用版本、签名、品牌资源和链接，再卸载。DMG 不签名、不公证。

需要 macOS arm64 和系统自带的 `ditto`、`plutil`、`codesign`、`hdiutil`，无需 npm 依赖。
打包不修改 `vendor/` 内核；`vendor/`、`dist/` 均不纳入 Git。
第三方声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)，同一份文件随 app 分发。

产品约定见 [docs/PLAN.md](docs/PLAN.md)。

## 说明

- 不公证。首次从浏览器下载后打开可能被系统拦，右键 → 打开。
- 第三方组件与许可证随包携带。
- 内核内部的 Chromium 文案保留不变，属于上游内核行为；应用显示名和图标使用「Mantle」品牌。
