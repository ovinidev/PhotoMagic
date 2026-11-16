import { describe, expect, it } from 'vitest'
import { latestReleaseTag, nextVersion } from './next-version.mjs'

describe('nextVersion', () => {
  it('bumps the patch of the latest tag when package.json was not bumped', () => {
    expect(nextVersion('0.2.0', ['v0.1.0', 'v0.2.0'])).toBe('0.2.1')
  })

  it('keeps bumping from the tag while package.json stays behind', () => {
    expect(nextVersion('0.2.0', ['v0.2.0', 'v0.2.1', 'v0.2.2'])).toBe('0.2.3')
  })

  it('publishes a manual minor or major bump as is', () => {
    expect(nextVersion('0.3.0', ['v0.2.0', 'v0.2.5'])).toBe('0.3.0')
    expect(nextVersion('1.0.0', ['v0.9.9'])).toBe('1.0.0')
  })

  it('bumps from the tag when a manual bump was already released', () => {
    expect(nextVersion('0.3.0', ['v0.3.0'])).toBe('0.3.1')
  })

  it('uses package.json when there is no release yet', () => {
    expect(nextVersion('0.1.0', [])).toBe('0.1.0')
  })

  it('compares numerically, not as text', () => {
    expect(nextVersion('0.2.0', ['v0.2.9', 'v0.2.10'])).toBe('0.2.11')
  })

  it('rejects a package.json version that is not x.y.z', () => {
    expect(() => nextVersion('0.2', [])).toThrow()
  })
})

describe('latestReleaseTag', () => {
  it('ignores non-release tags, prerelease tags and ls-remote noise', () => {
    expect(
      latestReleaseTag(['refs/tags/v0.2.0', 'refs/tags/v0.2.0^{}', 'refs/tags/v0.9.0-beta.1', 'foo', 'v0.1.0']),
    ).toEqual([0, 2, 0])
  })
})
