import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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
})
