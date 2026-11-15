# Mantle 品牌改名与安装验收

验收日期：2026-11-15，macOS arm64。本记录对应本次 Mantle 实际构建与安装。

## 产物与安装

- `dist/Mantle.app`
- `dist/Mantle-148.0.7778.215-arm64.dmg`
- `/Applications/Mantle.app`（通过 `ditto --norsrc --noextattr` 从构建产物安装）
- DMG：158,714,460 字节，158.71 MB / 151.36 MiB，UDZO，无签名、无公证。

## 自动验证

| 检查 | 结果 |
|---|---|
| `node --check scripts/package.mjs` | 通过 |
| `node scripts/package.mjs` | 成功生成 Mantle.app 和 DMG |
| `Contents/MacOS/Chromium --version` | 构建产物、DMG 内应用、安装版均为 `Chromium 148.0.7778.215` |
| `codesign --verify --deep --strict` | 构建产物、DMG 内应用和安装版均通过 |
| `codesign -dvv /Applications/Mantle.app` | `Signature=adhoc`，`Identifier=dev.matou.mantle` |
| DMG 挂载 | 只读挂载成功，包含 Mantle.app 与 `Applications -> /Applications`；检查后已卸载 |
| 图标与声明 | 构建产物、DMG 内应用和安装版与 `build/icon.icns`、根目录第三方声明内容一致 |
| 旧应用保护 | `/Applications/安全登录浏览器.app` 的 1460 个内部条目和根目录在安装前后相同；逐文件 SHA-256、路径、大小、修改时间、模式与软链接目标均一致 |

## Info.plist

以下字段已在构建产物、DMG 内应用和安装版读取核对：

| Key | 值 |
|---|---|
| CFBundleDisplayName | Mantle |
| CFBundleName | Mantle |
| CFBundleIdentifier | dev.matou.mantle |
| CFBundleShortVersionString | 148.0.7778.215 |
| CFBundleVersion | 148.0.7778.215 |
| CFBundleExecutable | Chromium |
| CFBundleIconFile | app.icns |

本次仅修改打包脚本的品牌名和 Bundle ID。可执行文件名、内核输入、图标和打包流程保持不变。
沿用打包流程移除主 app 的 `CFBundleIconName=AppIcon`，使系统使用 `app.icns`；
上游没有 KS/SU 更新器键。Framework、Helper 与内核内部 Chromium 文案保持原样。

## 真实启动与参数

分别直接启动构建产物和安装版的 `Contents/MacOS/Chromium`，未使用 headless。
每次使用 `dist/acceptance-mantle/` 下独立的一次性资料目录，参数为：

```text
--user-data-dir=<独立临时资料目录>
--timezone=America/Los_Angeles
--accept-lang=zh-CN,zh
--fingerprint=1000
--fingerprint-platform=macos
--remote-debugging-port=0
--no-first-run
--no-default-browser-check
file://<项目路径>/dist/acceptance-mantle/self-check.html
```

两次 CDP `Runtime.evaluate` 均实测得到：

```json
{
  "timezone": "America/Los_Angeles",
  "language": "zh-CN",
  "languages": ["zh-CN", "zh"],
  "platform": "MacIntel"
}
```

`Browser.getWindowForTarget` 均返回 1200 × 841、`windowState=normal`。
进程命令行已核对来自对应 app，包含以上时区和资料目录参数。
验收脚本首次读取早于页面就绪，未取得自检值；增加等待自检页面就绪后，构建产物和安装版检查均通过，未修改产品代码。

Terra 通过 `/Applications/Mantle.app` 绑定安装版并查看真实窗口：页面显示正确的时区、语言和平台；
系统菜单栏与展开菜单的标题均为 `Mantle`，菜单内部“关于 Chromium”等上游文案保留。
截图由电脑界面工具返回，工具没有提供保存图片到文件的接口，本次没有截图文件。
验收后通过 CDP `Browser.close` 关闭两次测试进程，确认已退出，并删除本次临时资料目录。

原始 CDP 数据、浏览器日志、旧应用前后只读快照与本地验收脚本保留在被 Git 忽略的
`dist/acceptance-mantle/`；打包、安装和安装版启动日志保留在任务运行目录的 `logs/`。

## 范围与未验证内容

没有修改 Matou、其他项目或旧应用；没有 push、发布、公证或修改系统安全设置。
两份未跟踪的任务 brief 保留原始交代内容，不纳入本次提交。
未验证 Matou 集成调用、带下载隔离标记的 Gatekeeper 行为、其他机型或其他 macOS 版本。
