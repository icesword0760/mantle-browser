#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { access, copyFile, lstat, mkdir, mkdtemp, readFile, readlink, rename, rm, stat, statfs, symlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const version = '148.0.7778.215'
const name = 'Mantle'
const source = join(root, 'vendor/chromium/Chromium.app')
const dist = join(root, 'dist')
const dmgName = `${name}-${version}-arm64.dmg`
const icon = join(root, 'build/icon.icns')
const notices = join(root, 'THIRD_PARTY_NOTICES.md')
const fields = {
  CFBundleDisplayName: name,
  CFBundleName: name,
  CFBundleIdentifier: 'dev.matou.mantle',
  CFBundleShortVersionString: version,
  CFBundleVersion: version,
  CFBundleIconFile: 'app.icns',
  CFBundleExecutable: 'Chromium',
}
const args = process.argv.slice(2)
const skipDmg = args.length === 1 && args[0] === '--skip-dmg'
const run = (command, argv, capture = false) => execFileSync(command, argv, {
  encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  maxBuffer: 4 * 1024 * 1024,
})
const plistAt = app => join(app, 'Contents/Info.plist')
const readPlist = path => JSON.parse(run('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path], true))
const binaryVersion = app => run(join(app, 'Contents/MacOS/Chromium'), ['--version'], true).trim()
const verify = async app => {
  const plist = readPlist(plistAt(app))
  for (const [key, value] of Object.entries(fields)) {
    if (plist[key] !== value) throw new Error(`${key}: expected ${value}, got ${plist[key]}`)
  }
  if (plist.CFBundleIconName || Object.keys(plist).some(key => /^(KS|SU)/.test(key))) {
    throw new Error('Unexpected asset-catalog icon or updater keys')
  }
  for (const [original, bundled] of [[icon, 'app.icns'], [notices, 'THIRD_PARTY_NOTICES.md']]) {
    if (!(await readFile(original)).equals(await readFile(join(app, 'Contents/Resources', bundled)))) {
      throw new Error(`Bundled resource mismatch: ${bundled}`)
    }
  }
  const actual = binaryVersion(app)
  if (actual !== `Chromium ${version}`) throw new Error(`Unexpected browser version: ${actual}`)
  console.log(actual)
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app])
}

async function main() {
  if (args.length && !skipDmg) throw new Error('Usage: node scripts/package.mjs [--skip-dmg]')
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Requires macOS arm64')
  try {
    await access(join(source, 'Contents/MacOS/Chromium'))
  } catch {
    throw new Error('Chromium 内核不存在，请先运行 node scripts/fetch-chromium.mjs')
  }
  if (!(await lstat(source)).isDirectory()) throw new Error('Chromium.app must be a directory, not a symlink')
  await access(icon)
  await access(notices)
  const original = readPlist(plistAt(source))
  if (original.CFBundleExecutable !== 'Chromium' || original.CFBundleIconFile !== 'app.icns') {
    throw new Error('Unexpected upstream executable/icon paths; packaging stopped without renaming internals')
  }
  if (binaryVersion(source) !== `Chromium ${version}`) throw new Error('Chromium version mismatch')
  // Allow space for the app copy, DMG staging and compression without filling the disk.
  const sourceKiB = Number(run('/usr/bin/du', ['-sk', source], true).split(/\s/)[0])
  const space = await statfs(root)
  if (space.bavail * space.bsize < sourceKiB * 1024 * 3 + 512 * 1024 * 1024) {
    throw new Error('磁盘空间不足，已停止打包；请先确认可用空间后重试')
  }
  await mkdir(dist, { recursive: true })
  const staging = await mkdtemp(join(dist, '.package-'))
  const payload = join(staging, 'payload')
  const app = join(payload, `${name}.app`)
  const mount = join(staging, 'mount')
  let mounted = false
  try {
    await mkdir(payload)
    // Finder metadata/resource forks from a local source are rejected by codesign.
    run('/usr/bin/ditto', ['--norsrc', '--noextattr', source, app])
    for (const [key, value] of Object.entries(fields)) {
      // Keep the upstream executable and icon filenames intact.
      if (key === 'CFBundleExecutable' || key === 'CFBundleIconFile') continue
      run('/usr/bin/plutil', ['-replace', key, '-string', value, plistAt(app)])
    }
    // An asset catalog name takes priority over CFBundleIconFile on macOS.
    if (Object.hasOwn(original, 'CFBundleIconName')) {
      run('/usr/bin/plutil', ['-remove', 'CFBundleIconName', plistAt(app)])
      console.log('Removed CFBundleIconName; using app.icns')
    }
    const updaterKeys = Object.keys(original).filter(key => /^(KS|SU)/.test(key))
    for (const key of updaterKeys) run('/usr/bin/plutil', ['-remove', key, plistAt(app)])
    console.log(`Updater keys removed: ${updaterKeys.join(', ') || 'none (not present upstream)'}`)
    await copyFile(icon, join(app, 'Contents/Resources/app.icns'))
    await copyFile(notices, join(app, 'Contents/Resources/THIRD_PARTY_NOTICES.md'))
    run('/usr/bin/plutil', ['-lint', plistAt(app)])
    run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', app])
    await verify(app)

    if (!skipDmg) {
      await symlink('/Applications', join(payload, 'Applications'))
      const dmg = join(staging, dmgName)
      run('/usr/bin/hdiutil', ['create', '-volname', name, '-srcfolder', payload,
        '-format', 'UDZO', '-imagekey', 'zlib-level=9', dmg])
      await mkdir(mount)
      run('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg])
      mounted = true
      await verify(join(mount, `${name}.app`))
      if (await readlink(join(mount, 'Applications')) !== '/Applications') throw new Error('Invalid Applications symlink')
      run('/usr/bin/hdiutil', ['detach', mount])
      mounted = false
      console.log(`DMG verified: ${((await stat(dmg)).size / 1024 / 1024).toFixed(2)} MiB`)
      await rename(dmg, join(dist, dmgName))
    }
    const output = join(dist, `${name}.app`)
    await rm(output, { recursive: true, force: true })
    await rename(app, output)
    console.log(`App: ${output}`)
    console.log(skipDmg ? 'DMG skipped (--skip-dmg)' : `DMG: ${join(dist, dmgName)}`)
    console.log(JSON.stringify(fields, null, 2))
  } finally {
    // Do not remove a mountpoint before detach succeeds.
    if (mounted) run('/usr/bin/hdiutil', ['detach', mount])
    await rm(staging, { recursive: true, force: true })
  }
}

main().catch(error => {
  console.error(`Packaging failed: ${error.message}`)
  process.exitCode = 1
})
