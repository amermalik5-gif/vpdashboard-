#!/usr/bin/env node
/**
 * NWC design system tool (plain Node, no dependencies).
 *
 * In a site's root folder:
 *   node design-system/tools/ds.mjs check
 *       Fails (exit 1) when the site drifts from the design system:
 *       - the locked copy in design-system/ was edited, or doesn't match design-system.lock.json
 *       - a required library is missing or on another major version
 *       - Tailwind doesn't use the design-system preset, or the CSS doesn't import its styles
 *       - a raw colour (#fff, rgb(…), hsl(…)), a font-family, or a Tailwind arbitrary colour
 *         (bg-[#…]) is written outside the design system. The one exception is the site's own
 *         semantic colours in src/styles/site-tokens.css, as CSS custom properties only.
 *         A line can opt out with a «ds-allow: reason» comment (e.g. <meta name="theme-color">).
 *   node design-system/tools/ds.mjs update <package-folder | vX.Y.Z>
 *       Replaces design-system/ with that version of the package and writes the lock file.
 *       A version (v1.1.0) is cloned from GitHub: the tag v1.1.0, or else the branch
 *       release/v1.1.0. A folder is a checkout of nwc-design-system.
 *
 * In the package's root folder:
 *   node tools/ds.mjs new-site <folder>
 *       Starts a new site from starter/, with a locked copy of this version.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE = 'nwc-design-system'
const REPO = 'https://github.com/amermalik5-gif/nwc-design-system.git'
const FOLDER = 'design-system'
const LOCK = 'design-system.lock.json'
/** What a site carries: everything a site needs, nothing of the package's own tooling. */
const VENDORED = ['VERSION', 'README.md', 'DESIGN.md', 'CHANGELOG.md', 'package.json', 'src', 'tools', 'reference']
const SCANNED = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.html'])

const posix = (p) => p.split(sep).join('/')
const read = (p) => readFileSync(p, 'utf8')
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .sort()
        .flatMap((n) => {
          const p = join(dir, n)
          return statSync(p).isDirectory() ? walk(p) : [p]
        })
    : []
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const fingerprint = (root) => Object.fromEntries(walk(root).map((f) => [posix(relative(root, f)), sha(readFileSync(f))]))
const major = (range) => Number(String(range).replace(/^[^\d]*/, '').split('.')[0])

/* ---------------------------------------------------------------- check */
const RULES = [
  { re: /(^|[^\w&/#-])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/, what: 'a raw colour code: use a token (a Tailwind colour class, or var(--token))' },
  // also inside Tailwind classes, where «_» joins the parts: shadow-[0_1px_2px_rgba(…)]
  { re: /(?:^|[^a-zA-Z0-9])(?:rgba?|hsla?)\(/, what: 'a raw colour (rgb/hsl): use a token, or add a semantic custom property to site-tokens.css' },
  { re: /font-family\s*:|fontFamily\s*[:=]/, what: 'a font-family: the design system sets the fonts (font-sans, font-ui)' },
  { re: /\b[\w:-]+-\[(?:#|rgba?\(|hsla?\()/, what: 'a Tailwind arbitrary colour: use a colour from the preset' },
]

function check() {
  const site = process.cwd()
  const folder = join(site, FOLDER)
  const problems = []
  const say = (file, msg) => problems.push(file ? `${file}: ${msg}` : msg)

  // 1. the locked copy
  let version = '?'
  if (!existsSync(folder) || !existsSync(join(site, LOCK))) say('', `no locked copy of the design system: run «node <path-to-${PACKAGE}>/tools/ds.mjs new-site» or «ds:update».`)
  else {
    const lock = JSON.parse(read(join(site, LOCK)))
    version = lock.version
    const now = fingerprint(folder)
    for (const [f, h] of Object.entries(lock.files)) {
      if (!(f in now)) say(`${FOLDER}/${f}`, 'removed from the locked copy')
      else if (now[f] !== h) say(`${FOLDER}/${f}`, 'edited: the design system is changed in the package, never in a site (then run ds:update)')
    }
    for (const f of Object.keys(now)) if (!(f in lock.files)) say(`${FOLDER}/${f}`, 'added to the locked copy')
    const v = existsSync(join(folder, 'VERSION')) ? read(join(folder, 'VERSION')).trim() : ''
    if (v && v !== lock.version) say(LOCK, `says ${lock.version} but the copy is ${v}`)
  }

  // 2. the libraries the components are built on, at the same major versions
  if (existsSync(join(folder, 'package.json'))) {
    const peers = JSON.parse(read(join(folder, 'package.json'))).peerDependencies ?? {}
    const pkg = JSON.parse(read(join(site, 'package.json')))
    for (const [name, range] of Object.entries(peers)) {
      const declared = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]
      if (!declared) {
        say('package.json', `needs ${name} ${range}`)
        continue
      }
      const installed = join(site, 'node_modules', name, 'package.json')
      const v = existsSync(installed) ? JSON.parse(read(installed)).version : declared
      if (major(v) !== major(range)) say('package.json', `${name} ${v} is not the version the design system is built on (${range})`)
    }
  }

  // 3. Tailwind uses the preset, and the CSS imports the design-system styles
  const tw = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs', 'tailwind.config.cjs'].find((f) => existsSync(join(site, f)))
  if (!tw || !read(join(site, tw)).includes(`${FOLDER}/src/tailwind-preset`)) say(tw ?? 'tailwind.config.ts', `must use the design-system preset (presets: [preset] from ./${FOLDER}/src/tailwind-preset)`)
  const files = [...walk(join(site, 'src')), ...(existsSync(join(site, 'index.html')) ? [join(site, 'index.html')] : [])].filter((f) => SCANNED.has(extname(f)))
  if (!files.some((f) => extname(f) === '.css' && read(f).includes(`${FOLDER}/src/styles/index.css`))) say('src/', `the site's CSS must @import ${FOLDER}/src/styles/index.css`)

  // 4. no raw colours or fonts outside the design system
  for (const f of files) {
    const rel = posix(relative(site, f))
    const siteTokens = rel.endsWith('site-tokens.css')
    read(f)
      .split('\n')
      .forEach((line, i) => {
        if (/ds-allow/.test(line)) return
        // the site's own semantic colours: custom properties only (--name: value;)
        if (siteTokens && /^\s*--[\w-]+\s*:/.test(line)) return
        for (const r of RULES) if (r.re.test(line)) say(`${rel}:${i + 1}`, `${r.what}\n      ${line.trim().slice(0, 140)}`)
      })
  }

  if (problems.length) {
    console.error(`✗ The site doesn't follow the NWC design system ${version} (${problems.length}):\n`)
    for (const p of problems) console.error(`  - ${p}`)
    console.error(`\n  The rules: ${FOLDER}/DESIGN.md`)
    process.exit(1)
  }
  console.log(`✓ NWC design system ${version}: locked copy intact, preset and styles in use, ${files.length} files without raw colours or fonts.`)
}

/* ---------------------------------------------------------------- update */
function update(source, site = process.cwd()) {
  if (!source) throw new Error('which version? «ds:update v1.1.0» or «ds:update ../nwc-design-system»')
  let from = source
  if (/^v?\d+\.\d+\.\d+$/.test(source)) {
    // a version is the tag vX.Y.Z or, where tags can't be created, the branch release/vX.Y.Z
    const v = source.startsWith('v') ? source : `v${source}`
    from = null
    for (const ref of [v, `release/${v}`]) {
      const dir = mkdtempSync(join(tmpdir(), 'nwc-ds-'))
      try {
        execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', ref, REPO, dir], { stdio: ['ignore', 'ignore', 'pipe'] })
        from = dir
        break
      } catch {
        rmSync(dir, { recursive: true, force: true })
      }
    }
    if (!from) throw new Error(`version ${v} not found in ${REPO} (neither the tag ${v} nor the branch release/${v})`)
  }
  from = resolve(from)
  if (!existsSync(join(from, 'VERSION')) || !existsSync(join(from, 'tools', 'ds.mjs'))) throw new Error(`${from} is not a checkout of ${PACKAGE}`)
  const folder = join(site, FOLDER)
  rmSync(folder, { recursive: true, force: true })
  mkdirSync(folder, { recursive: true })
  for (const item of VENDORED) cpSync(join(from, item), join(folder, item), { recursive: true })
  const version = read(join(folder, 'VERSION')).trim()
  writeFileSync(join(site, LOCK), JSON.stringify({ package: PACKAGE, version, files: fingerprint(folder) }, null, 2) + '\n')
  console.log(`✓ ${FOLDER}/ is now ${PACKAGE} ${version} (locked in ${LOCK}).`)
}

/* ---------------------------------------------------------------- new site */
function newSite(target) {
  if (!target) throw new Error('where? «npm run new-site -- ../my-new-site»')
  const root = dirname(dirname(fileURLToPath(import.meta.url)))
  const to = resolve(target)
  if (existsSync(to) && readdirSync(to).length) throw new Error(`${to} is not empty`)
  cpSync(join(root, 'starter'), to, { recursive: true })
  update(root, to)
  console.log(`✓ New site in ${to}. Next: cd there, «npm install», then «npm run dev».`)
}

const [cmd, arg] = process.argv.slice(2)
try {
  if (cmd === 'check') check()
  else if (cmd === 'update') update(arg)
  else if (cmd === 'new-site') newSite(arg)
  else {
    console.error('usage: ds.mjs check | update <package-folder | vX.Y.Z> | new-site <folder>')
    process.exit(2)
  }
} catch (e) {
  console.error(`✗ ${e.message}`)
  process.exit(1)
}
