// Labels the PRs shipped in a release with its vX.Y.Z (CLAUDE.md "Releasing a version").
// Pure helpers live here; label-prs-cli.mjs runs git and gh.
import { compareVersions, parseVersion } from './next-version.mjs'

/** Highest v<x.y.z> tag strictly below `tag`, or null when there is none. */
export function previousReleaseTag(tags, tag) {
  const current = parseVersion(tag.replace(/^v/, ''))
  if (!current) throw new Error(`"${tag}" is not v<x.y.z>`)
  let best = null
  for (const name of tags) {
    const version = name.startsWith('v') ? parseVersion(name.slice(1)) : null
    if (!version || compareVersions(version, current) >= 0) continue
    if (!best || compareVersions(version, best.version) > 0) best = { name, version }
  }
  return best ? best.name : null
}

/** Merged PR numbers into `base` from the per-commit `commits/{sha}/pulls` answers, deduped and sorted. */
export function mergedPrNumbers(pullLists, base = 'main') {
  const numbers = new Set()
  for (const pulls of pullLists) {
    for (const pr of pulls) {
      if (pr.merged_at && pr.base?.ref === base) numbers.add(pr.number)
    }
  }
  return [...numbers].sort((a, b) => a - b)
}
