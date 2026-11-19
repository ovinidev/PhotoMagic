import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEED_LAYOUTS } from '@shared/layout'
import { eventState, stubBridge } from '@renderer/test/bridge'
import { revealBoxes, revealTotal } from '../utils/reveal'
import { MontageReveal } from './MontageReveal'
import { PrintScreen } from './PrintScreen'

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
}

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:montage')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('MontageReveal', () => {
  const boxes = revealBoxes('one-strip', SEED_LAYOUTS['one-strip'])

  it('slides one crop of the montage into each box, then removes itself', () => {
    vi.useFakeTimers()
    mockReducedMotion(false)
    render(<MontageReveal url="blob:montage" boxes={boxes} />)
    const overlay = screen.getByTestId('montage-reveal')
    expect(overlay.querySelectorAll('[data-reveal-box]')).toHaveLength(3)
    expect(overlay.querySelector('img')).toHaveAttribute('src', 'blob:montage')
    expect((overlay.querySelectorAll<HTMLElement>('[data-reveal-box]')[1]!).style.getPropertyValue('--reveal-delay')).toBe(`${boxes[1]!.delay}ms`)
    act(() => vi.advanceTimersByTime(revealTotal(boxes) + 100))
    expect(screen.queryByTestId('montage-reveal')).toBeNull()
  })

  it('renders nothing under prefers-reduced-motion', () => {
    mockReducedMotion(true)
    render(<MontageReveal url="blob:montage" boxes={boxes} />)
    expect(screen.queryByTestId('montage-reveal')).toBeNull()
  })

  it('starts on the print screen once the preview has loaded, only in review', async () => {
    mockReducedMotion(false)
    stubBridge({ session: { getPreview: () => Promise.resolve({ revision: 1, jpeg: new Uint8Array([1]) }) } })
    const { unmount } = render(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'review' } })} />)
    const preview = await screen.findByAltText('Prévia da montagem')
    expect(preview).toHaveClass('opacity-0')
    expect(screen.queryByTestId('montage-reveal')).toBeNull()
    fireEvent.load(preview)
    expect(screen.getByTestId('montage-reveal')).toBeInTheDocument()
    expect(preview).not.toHaveClass('opacity-0')
    unmount()

    render(<PrintScreen session={eventState({ taken: 3, phase: { kind: 'printed', fileName: '21-45-08.jpg' } })} />)
    fireEvent.load(await screen.findByAltText('Prévia da montagem'))
    expect(screen.queryByTestId('montage-reveal')).toBeNull()
  })
})
