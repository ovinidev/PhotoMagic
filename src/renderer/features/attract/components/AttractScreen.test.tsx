import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubBridge } from '@renderer/test/bridge'
import { ATTRACT_IDLE_MS, ATTRACT_SLIDE_MS } from '../utils/slides'
import { AttractScreen } from './AttractScreen'

function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: reduce && query.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }),
  })
}

const names = (count: number) => Array.from({ length: count }, (_, index) => `10-00-${String(59 - index).padStart(2, '0')}.jpg`)

async function goIdle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ATTRACT_IDLE_MS)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  setReducedMotion(false)
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:thumb')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('AttractScreen', () => {
  it('stays hidden until the round sits idle, then shows the brand art when there is no montage', async () => {
    stubBridge()
    render(<AttractScreen active />)
    expect(screen.queryByTestId('attract-screen')).toBeNull()
    await goIdle()
    expect(screen.getByRole('button', { name: 'Toque para começar' })).toBeInTheDocument()
    expect(screen.getByTestId('attract-brand')).toBeInTheDocument()
    expect(screen.getByAltText('Foto Mágica')).toBeInTheDocument()
  })

  it('cycles only the 12 newest thumbnails, two mounted at most', async () => {
    const bridge = stubBridge({ gallery: { list: () => Promise.resolve({ fileNames: names(20) }), get: () => Promise.resolve({ jpeg: new Uint8Array([1]) }) } })
    render(<AttractScreen active />)
    await goIdle()
    expect(screen.getAllByTestId('attract-slide').map((slide) => slide.dataset['fileName'])).toEqual(['10-00-59.jpg'])
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ATTRACT_SLIDE_MS)
    })
    expect(screen.getAllByTestId('attract-slide').map((slide) => slide.dataset['fileName'])).toEqual(['10-00-59.jpg', '10-00-58.jpg'])
    for (let step = 0; step < 12; step++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ATTRACT_SLIDE_MS)
      })
      expect(screen.getAllByTestId('attract-slide').length).toBeLessThanOrEqual(2)
    }
    const requested = new Set(bridge.api.gallery.get.mock.calls.map(([input]) => input.fileName))
    expect(requested.size).toBe(12)
    expect(bridge.api.gallery.get.mock.calls.every(([input]) => input.size === 'thumb')).toBe(true)
  })

  it('under reduced motion shows the newest montage, still', async () => {
    setReducedMotion(true)
    stubBridge({ gallery: { list: () => Promise.resolve({ fileNames: names(3) }), get: () => Promise.resolve({ jpeg: new Uint8Array([1]) }) } })
    render(<AttractScreen active />)
    await goIdle()
    expect(screen.getByTestId('attract-screen')).toHaveAttribute('data-motion', 'reduced')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ATTRACT_SLIDE_MS * 3)
    })
    expect(screen.getAllByTestId('attract-slide').map((slide) => slide.dataset['fileName'])).toEqual(['10-00-59.jpg'])
  })

  it('a tap fades it out and it comes back only after another idle stretch', async () => {
    stubBridge()
    render(<AttractScreen active />)
    await goIdle()
    fireEvent.click(screen.getByRole('button', { name: 'Toque para começar' }))
    expect(screen.getByTestId('attract-screen')).toHaveAttribute('inert')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(screen.queryByTestId('attract-screen')).toBeNull()
    await goIdle()
    expect(screen.getByTestId('attract-screen')).not.toHaveAttribute('inert')
  })
})
