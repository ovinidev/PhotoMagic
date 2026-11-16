import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOSE_HOLD } from '@shared/closeHold'
import { stubBridge } from '@renderer/test/bridge'
import { CloseHoldLayer } from './CloseHoldLayer'

const finger = (x: number, y: number) => ({ clientX: x, clientY: y })
const touch = (type: 'touchStart' | 'touchEnd', touches: Array<ReturnType<typeof finger>>) => act(() => void fireEvent[type](window, { touches }))
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

describe('CloseHoldLayer (TV two-finger hold)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout'] }))
  afterEach(() => vi.useRealTimers())

  it('shows the hint while two fingers are held and hides the TV after 2 s', () => {
    const bridge = stubBridge()
    render(<CloseHoldLayer />)
    touch('touchStart', [finger(100, 500), finger(300, 500)])
    expect(screen.queryByTestId('close-hold-hint')).not.toBeInTheDocument()
    advance(CLOSE_HOLD.hintAfterMs + 50)
    expect(screen.getByText('Continue segurando com dois dedos para fechar a tela')).toBeInTheDocument()
    expect(bridge.api.display.hideTv).not.toHaveBeenCalled()
    advance(CLOSE_HOLD.ms)
    expect(bridge.api.display.hideTv).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('close-hold-hint')).not.toBeInTheDocument()
  })

  it('does nothing for one finger or a quick two-finger tap', () => {
    const bridge = stubBridge()
    render(<CloseHoldLayer />)
    touch('touchStart', [finger(100, 500)])
    advance(3 * CLOSE_HOLD.ms)
    touch('touchEnd', [])
    touch('touchStart', [finger(100, 500), finger(300, 500)])
    advance(100)
    touch('touchEnd', [])
    advance(3 * CLOSE_HOLD.ms)
    expect(screen.queryByTestId('close-hold-hint')).not.toBeInTheDocument()
    expect(bridge.api.display.hideTv).not.toHaveBeenCalled()
  })
})
