import { StrictMode, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useObjectUrl } from './useObjectUrl'

describe('useObjectUrl', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns a URL that is still live after the StrictMode double mount', () => {
    let next = 0
    const live = new Set<string>()
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      const url = `blob:test-${next++}`
      live.add(url)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void live.delete(url))
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>
    const bytes = new Uint8Array([1, 2, 3])

    const { result, unmount } = renderHook(() => useObjectUrl(bytes), { wrapper })

    expect(result.current).not.toBeNull()
    expect(live.has(result.current as string)).toBe(true)
    unmount()
    expect(live.size).toBe(0)
  })

  it('returns null without bytes', () => {
    const { result } = renderHook(() => useObjectUrl(null))
    expect(result.current).toBeNull()
  })
})
