// CI entry point for release.yml: prints the next version to stdout.
// Usage: git ls-remote --tags origin 'v*' | node scripts/release/next-version-cli.mjs
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { nextVersion } from './next-version.mjs'

const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'))
const tags = readFileSync(0, 'utf8')
  .split('\n')
  .map((line) => line.trim().split(/\s+/).pop())
  .filter(Boolean)
process.stdout.write(`${nextVersion(pkg.version, tags)}\n`)
