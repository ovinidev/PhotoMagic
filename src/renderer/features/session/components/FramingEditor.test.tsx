import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { EventSession } from '@shared/ipc'
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
    const baixo = screen.getByRole('button', { name: 'Enquadrar Baixo 1' }).querySelector('img')!
    expect(baixo.style.transform).toMatch(/^translate\(-50%, -50%\) translate\(-?[\d.]+%, -?[\d.]+%\) rotate\(0deg\)$/)
    vi.unstubAllGlobals()
  })
})
