// The version a push to main releases (DESIGN §12, CLAUDE.md "Releasing a version").
// The latest published v<x.y.z> tag is the source of truth; package.json only wins when a PR bumped it
// above that tag (a manual minor or major). Otherwise the release is the latest tag plus one patch.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/** Parses a plain x.y.z version (no prefix, no prerelease) or returns null. */
export function parseVersion(text) {
  const match = SEMVER.exec(String(text).trim())
  return match ? match.slice(1).map(Number) : null
}

/** Negative, zero or positive, like a sort comparator. */
export function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return 0
}

/** Highest v<x.y.z> among tag names (refs/tags/ prefixes and ^{} peel suffixes are ignored). */
export function latestReleaseTag(tags) {
  let latest = null
  for (const raw of tags) {
    const name = raw.replace(/^refs\/tags\//, '').replace(/\^\{\}$/, '')
    if (!name.startsWith('v')) continue
    const version = parseVersion(name.slice(1))
    if (version && (!latest || compareVersions(version, latest) > 0)) latest = version
  }
  return latest
}

/** package.json version when it is above every release tag, else the latest tag plus one patch. */
export function nextVersion(packageVersion, tags) {
  const current = parseVersion(packageVersion)
  if (!current) throw new Error(`package.json version "${packageVersion}" is not x.y.z`)
  const latest = latestReleaseTag(tags)
  if (!latest || compareVersions(current, latest) > 0) return current.join('.')
  return [latest[0], latest[1], latest[2] + 1].join('.')
}
