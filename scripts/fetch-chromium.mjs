#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { lstat, mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const expected = 'Chromium 148.0.7778.215'
const url = 'https://github.com/adryfish/fingerprint-chromium/releases/download/148.0.7778.215/ungoogled-chromium_148.0.7778.215-1.1_macos.dmg'
const vendor = join(root, 'vendor/chromium')
const target = join(vendor, 'Chromium.app')
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--from')) throw new Error('Usage: node scripts/fetch-chromium.mjs [--from /path/Chromium.app]')
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Requires macOS arm64')
await mkdir(vendor, { recursive: true })
const staging = await mkdtemp(join(vendor, '.fetch-'))
let mounted = false
const mount = join(staging, 'mount')
const run = (command, argv) => execFileSync(command, argv, { encoding: 'utf8', maxBuffer: 1024 * 1024 })
const version = appPath => run(join(appPath, 'Contents/MacOS/Chromium'), ['--version']).trim()
try {
  let source
  if (args.length) {
    source = resolve(args[1])
    if (source === target) throw new Error('Source must differ from destination')
    const stat = await lstat(source)
    if (stat.isSymbolicLink() || !stat.isDirectory() || !source.endsWith('.app')) throw new Error('Source must be an existing .app directory')
  } else {
    const dmg = join(staging, 'chromium.dmg')
    const response = await fetch(url, { signal: AbortSignal.timeout(600000) })
    if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status}`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(dmg, { flags: 'wx' }))
    if ((await lstat(dmg)).size < 100 * 1024 * 1024) throw new Error('Downloaded DMG is unexpectedly small')
    await mkdir(mount)
    run('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg])
    mounted = true
    const candidates = (await readdir(mount)).filter(name => name === 'Chromium.app')
    if (candidates.length !== 1) throw new Error('Chromium.app not found in DMG')
    source = join(mount, candidates[0])
  }
  const stagedApp = join(staging, 'Chromium.app')
  run('/usr/bin/ditto', [source, stagedApp])
  if (version(stagedApp) !== expected) throw new Error('Chromium version mismatch')
  await rm(target, { recursive: true, force: true })
  await rename(stagedApp, target)
  const installedVersion = version(target)
  if (installedVersion !== expected) throw new Error('Installed Chromium version mismatch')
  console.log(installedVersion)
} finally {
  if (mounted) run('/usr/bin/hdiutil', ['detach', mount])
  await rm(staging, { recursive: true, force: true })
}
