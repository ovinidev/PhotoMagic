import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EventSession } from '@shared/ipc'
import { TWO_STRIPS_SEED } from '@shared/layout'
import { eventState, stubBridge } from '@renderer/test/bridge'
import { useFramingEditor } from './FramingEditor'

function Harness({ session }: { session: EventSession }) {
  const { overlay, controls } = useFramingEditor(session)
  return (
    <div>
      {overlay}
      {controls}
    </div>
  )
}

describe('useFramingEditor (RF09)', () => {
  it('offers only the slots whose photo is taken, and frames the selected one only', async () => {
    const { api } = stubBridge()
    render(<Harness session={eventState({ taken: 1 })} />)
    expect(screen.getByTestId('framing-readout')).toHaveTextContent('Clique numa foto da montagem')
    expect(screen.getByRole('button', { name: 'Aproximar' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Enquadrar Baixo 1' }))
    expect(screen.getByRole('button', { name: 'Enquadrar Baixo 1' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Aproximar' }))
    expect(api.session.setFraming).toHaveBeenLastCalledWith({ slotId: 'bottom-1', framing: { zoom: 1.25, panX: 0, panY: 0, rotation: 0 } })
    expect(screen.getByTestId('framing-readout')).toHaveTextContent('Baixo 1: zoom 1,25× · giro 0°')

    await userEvent.click(screen.getByRole('button', { name: 'Girar para a direita' }))
    expect(api.session.setFraming).toHaveBeenLastCalledWith({ slotId: 'bottom-1', framing: { zoom: 1.25, panX: 0, panY: 0, rotation: 5 } })
    expect(api.session.setFraming.mock.calls.every(([input]) => input.slotId === 'bottom-1')).toBe(true)
  })

  it('shows the framing main already has', async () => {
    stubBridge()
    render(<Harness session={eventState({ taken: 3, phase: { kind: 'review' }, framings: { 'top-1': { zoom: 2, panX: 0, panY: 0, rotation: -10 } } })} />)
    await userEvent.click(screen.getByRole('button', { name: 'Enquadrar Cima 1' }))
    expect(screen.getByTestId('framing-readout')).toHaveTextContent('Cima 1: zoom 2× · giro -10°')
  })

  it('is not offered once the montage is written', () => {
    stubBridge()
    render(<Harness session={eventState({ taken: 3, phase: { kind: 'printed', fileName: '21-45-08.jpg' } })} />)
    expect(screen.queryByRole('button', { name: /Enquadrar/ })).toBeNull()
    expect(screen.queryByTestId('framing-controls')).toBeNull()
  })

  it('draws the photo inside the slot, clipped to its rounded box, where the composer puts it', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1080, height: 1920, close: () => {} })))
    const { api } = stubBridge({ session: { getPhoto: () => Promise.resolve(new Uint8Array([1, 2, 3])) } })
    render(<Harness session={eventState({ taken: 1, framings: { 'bottom-1': { zoom: 2, panX: 0.5, panY: 0, rotation: 0 } } })} />)
    const photos = await screen.findAllByTestId('framing-photo')
    // Photo 1 fills Cima 1 and Baixo 1, each in its own mask.
    expect(photos).toHaveLength(2)
    expect(api.session.getPhoto).toHaveBeenCalledWith(1)
    for (const mask of screen.getAllByTestId('framing-photo-mask')) {
      expect(mask).toHaveClass('overflow-hidden')
    }
    const baixo = document.querySelector('[data-mask-for="bottom-1"] [data-testid="framing-photo"]') as HTMLImageElement
    expect(baixo.style.transform).toMatch(/^translate\(-50%, -50%\) translate\(-?[\d.]+%, -?[\d.]+%\) rotate\(0deg\)$/)
    vi.unstubAllGlobals()
  })

  it('clips a moved, enlarged slot to its fixed gray box and fills the box with the photo', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1080, height: 1920, close: () => {} })))
    stubBridge({ session: { getPhoto: () => Promise.resolve(new Uint8Array([1, 2, 3])) } })
    const base = eventState({ taken: 1 })
    const slots = TWO_STRIPS_SEED.map((slot) => (slot.id === 'bottom-1' ? { ...slot, left: 20, top: 500, width: 900, height: 700 } : slot))
    render(<Harness session={{ ...base, slots }} />)
    await screen.findAllByTestId('framing-photo')
    const mask = document.querySelector<HTMLElement>('[data-mask-for="bottom-1"]')!
    // Baixo 1's gray box, 62/733 602×402 on the 1844×1240 sheet, not the moved slot.
    expect(parseFloat(mask.style.left)).toBeCloseTo((62 / 1844) * 100, 3)
    expect(parseFloat(mask.style.width)).toBeCloseTo((602 / 1844) * 100, 3)
    expect(mask).toHaveClass('overflow-hidden')
    expect(mask.style.borderRadius).not.toBe('')
    expect(mask.querySelector('[data-testid="framing-photo-fill"]')).not.toBeNull()
    // A slot on its seed needs no fill.
    expect(document.querySelector('[data-mask-for="top-1"] [data-testid="framing-photo-fill"]')).toBeNull()
    vi.unstubAllGlobals()
  })
})
