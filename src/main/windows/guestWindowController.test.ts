import { describe, expect, it, vi } from 'vitest'
import type { DisplayInfo } from '@shared/displays'
import type { DisplayState } from '@shared/ipc'
import { createFixtureDisplaySource } from './displayFixtures'
import { createGuestWindowController, type GuestWindowHandle } from './guestWindowController'

const tv: DisplayInfo = { id: 2, primary: false, x: 1920, y: 0, width: 1080, height: 1920 }

function fakeWindow() {
  let closed: (() => void) | undefined
  const window = {
    place: vi.fn<(display: DisplayInfo) => void>(),
    hide: vi.fn(),
    destroy: vi.fn(() => closed?.()),
    onClosed: (listener: () => void) => {
      closed = listener
    },
    /** Simulates the window going away on its own, e.g. at app quit. */
    closeExternally: () => closed?.(),
  }
  return window satisfies GuestWindowHandle
}

function setup(initial: Parameters<typeof createFixtureDisplaySource>[0]) {
  const displays = createFixtureDisplaySource(initial)
  const windows: Array<ReturnType<typeof fakeWindow>> = []
  const controller = createGuestWindowController({
    displays,
    createWindow: () => {
      const window = fakeWindow()
      windows.push(window)
      return window
    },
  })
  const states: DisplayState[] = []
  controller.onChange((state) => states.push(state))
  return { displays, windows, controller, states }
}

describe('guest window controller', () => {
  it('reports the TV choice before any window exists', () => {
    expect(setup('portrait-tv').controller.state()).toEqual({ guest: { kind: 'portrait', display: tv }, tv: { kind: 'closed' } })
    expect(setup('laptop-only').controller.state().guest).toEqual({ kind: 'missing' })
  })

  it('opens one window covering the portrait TV, and opening again reuses it', () => {
    const { controller, windows, states } = setup('portrait-tv')
    expect(controller.open()).toEqual({
      ok: true,
      state: { guest: { kind: 'portrait', display: tv }, tv: { kind: 'open', display: tv } },
    })
    controller.open()
    expect(windows).toHaveLength(1)
    expect(windows[0]!.place).toHaveBeenLastCalledWith(tv)
    expect(states.at(-1)?.tv).toEqual({ kind: 'open', display: tv })
  })

  it('does not create a window with only the laptop', () => {
    const { controller, windows } = setup('laptop-only')
    expect(controller.open()).toMatchObject({ ok: false, reason: 'missing' })
    expect(windows).toHaveLength(0)
  })

  it('never opens on a landscape TV', () => {
    const { controller, windows } = setup('landscape-tv')
    expect(controller.open()).toMatchObject({ ok: false, reason: 'landscape' })
    expect(windows).toHaveLength(0)
  })

  it('hides the window when the TV is unplugged and brings it back when it returns', () => {
    const { controller, displays, windows, states } = setup('portrait-tv')
    controller.open()
    const window = windows[0]!

    displays.set('laptop-only')
    expect(window.hide).toHaveBeenCalledTimes(1)
    expect(window.destroy).not.toHaveBeenCalled()
    expect(states.at(-1)).toEqual({ guest: { kind: 'missing' }, tv: { kind: 'detached', reason: 'missing' } })

    displays.set('portrait-tv')
    expect(window.place).toHaveBeenLastCalledWith(tv)
    expect(windows).toHaveLength(1)
    expect(states.at(-1)?.tv).toEqual({ kind: 'open', display: tv })
  })

  it('the two-finger hold hides the window without closing it, and the laptop reopens it', () => {
    const { controller, displays, windows, states } = setup('portrait-tv')
    controller.open()
    const window = windows[0]!

    expect(controller.dismiss().tv).toEqual({ kind: 'hidden' })
    expect(window.hide).toHaveBeenCalledTimes(1)
    expect(window.destroy).not.toHaveBeenCalled()
    expect(states.at(-1)?.tv).toEqual({ kind: 'hidden' })

    // A monitor change does not bring it back on its own.
    displays.set('laptop-only')
    displays.set('portrait-tv')
    expect(window.place).toHaveBeenCalledTimes(1)
    expect(controller.state().tv).toEqual({ kind: 'hidden' })

    expect(controller.reopen().tv).toEqual({ kind: 'open', display: tv })
    expect(window.place).toHaveBeenCalledTimes(2)
    expect(windows).toHaveLength(1)
  })

  it('reopening without a TV reports it detached, and dismiss or reopen without a window do nothing', () => {
    const { controller, displays } = setup('portrait-tv')
    expect(controller.dismiss().tv).toEqual({ kind: 'closed' })
    expect(controller.reopen().tv).toEqual({ kind: 'closed' })
    controller.open()
    controller.dismiss()
    displays.set('laptop-only')
    expect(controller.reopen().tv).toEqual({ kind: 'detached', reason: 'missing' })
    displays.set('portrait-tv')
    expect(controller.state().tv).toEqual({ kind: 'open', display: tv })
  })

  it('hides the window when the TV turns landscape and brings it back in portrait', () => {
    const { controller, displays, windows } = setup('portrait-tv')
    controller.open()
    displays.set('landscape-tv')
    expect(windows[0]!.hide).toHaveBeenCalledTimes(1)
    expect(controller.state().tv).toEqual({ kind: 'detached', reason: 'landscape' })
    displays.set('portrait-tv')
    expect(controller.state().tv).toEqual({ kind: 'open', display: tv })
  })

  it('broadcasts monitor changes while the TV window is closed', () => {
    const { displays, states } = setup('laptop-only')
    displays.set('portrait-tv')
    expect(states.at(-1)).toEqual({ guest: { kind: 'portrait', display: tv }, tv: { kind: 'closed' } })
  })

  it('close destroys the window and reports closed', () => {
    const { controller, windows, states } = setup('portrait-tv')
    controller.open()
    expect(controller.close().tv).toEqual({ kind: 'closed' })
    expect(windows[0]!.destroy).toHaveBeenCalledTimes(1)
    expect(states.filter((state) => state.tv.kind === 'closed')).toHaveLength(1)
  })

  it('reports closed when the window goes away on its own (app quit)', () => {
    const { controller, windows, states } = setup('portrait-tv')
    controller.open()
    windows[0]!.closeExternally()
    expect(controller.state().tv).toEqual({ kind: 'closed' })
    expect(states.at(-1)?.tv).toEqual({ kind: 'closed' })
  })

  it('does not re-place the window when a monitor event leaves the TV unchanged', () => {
    const { controller, displays, windows } = setup('portrait-tv')
    controller.open()
    displays.set('portrait-tv')
    expect(windows[0]!.place).toHaveBeenCalledTimes(1)
  })
})
