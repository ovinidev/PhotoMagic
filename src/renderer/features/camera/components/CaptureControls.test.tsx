import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eventState, stubBridge } from '@renderer/test/bridge'
import type { ShutterState } from '../hooks/useShutter'
import { CaptureControls } from './CaptureControls'
import { TvTopBar } from './TvTopBar'

beforeEach(() => {
  stubBridge()
})

const shutter = (over: Partial<ShutterState> = {}): ShutterState => ({ trigger: vi.fn(), busy: false, countdown: null, flashing: false, failed: false, ...over })

describe('CaptureControls', () => {
  it('draws a 240 px iPhone-style shutter with a pressed state and fires on tap', async () => {
    const state = shutter()
    render(<CaptureControls session={eventState({ taken: 1 })} shutter={state} disabled={false} />)
    const button = screen.getByRole('button', { name: 'Tirar foto' })
    expect(button).toHaveClass('size-60', 'rounded-full', 'border-white')
    expect(button.firstElementChild).toHaveClass('bg-shutter', 'group-active:scale-[0.86]')
    expect(screen.getByTestId('photo-counter')).toHaveTextContent('2/3')
    await userEvent.click(button)
    expect(state.trigger).toHaveBeenCalledTimes(1)
  })

  it('shows the countdown and disables the shutter while it runs', () => {
    render(<CaptureControls session={eventState({ taken: 0 })} shutter={shutter({ busy: true, countdown: 3 })} disabled={false} />)
    expect(screen.getByTestId('countdown')).toHaveTextContent('3')
    expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeDisabled()
  })
})

describe('TvTopBar', () => {
  it('has the adjustments icon and no grid toggle', () => {
    render(<TvTopBar />)
    expect(screen.getByRole('button', { name: /ajust/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Grade de terços' })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
