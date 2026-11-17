import { describe, expect, it } from 'vitest'
import { mergedPrNumbers, previousReleaseTag } from './label-prs.mjs'

describe('previousReleaseTag', () => {
  it('picks the highest tag below the new one', () => {
    expect(previousReleaseTag(['v0.2.0', 'v0.2.1', 'v0.2.2', 'v0.3.0'], 'v0.2.2')).toBe('v0.2.1')
    expect(previousReleaseTag(['v0.2.9', 'v0.3.0'], 'v0.3.0')).toBe('v0.2.9')
  })

  it('compares numerically and ignores non-release tags', () => {
    expect(previousReleaseTag(['v0.2.9', 'v0.2.10', 'vnext', 'foo'], 'v0.2.11')).toBe('v0.2.10')
  })

  it('returns null for the first release', () => {
    expect(previousReleaseTag(['v0.1.0'], 'v0.1.0')).toBeNull()
  })
})

describe('mergedPrNumbers', () => {
  const pr = (number, merged_at, ref = 'main') => ({ number, merged_at, base: { ref } })

  it('dedupes, sorts and keeps only merged PRs into main', () => {
    const lists = [[pr(5, 'x'), pr(3, 'x')], [pr(5, 'x')], [pr(9, null)], [pr(7, 'x', 'dev')], []]
    expect(mergedPrNumbers(lists)).toEqual([3, 5])
  })

  it('returns an empty list when nothing matches', () => {
    expect(mergedPrNumbers([[], []])).toEqual([])
  })
})
