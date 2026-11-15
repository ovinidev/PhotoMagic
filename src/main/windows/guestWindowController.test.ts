import { describe, expect, it, vi } from 'vitest'
import type { DisplayInfo } from '@shared/displays'
import type { DisplayState } from '@shared/ipc'
import { createFixtureDisplaySource } from './displayFixtures'
import { createGuestWindowController, type GuestWindowHandle } from './guestWindowController'

const tv: DisplayInfo = { id: 2, primary: false, x: 1920, y: 0, width: 1080, height: 1920 }
const landscapeTv: DisplayInfo = { id: 3, primary: false, x: 1920, y: 0, width: 1920, height: 1080 }

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
    expect(controller.open({ allowLandscape: false })).toEqual({
      ok: true,
      state: { guest: { kind: 'portrait', display: tv }, tv: { kind: 'open', display: tv } },
    })
    controller.open({ allowLandscape: false })
    expect(windows).toHaveLength(1)
    expect(windows[0]!.place).toHaveBeenLastCalledWith(tv)
    expect(states.at(-1)?.tv).toEqual({ kind: 'open', display: tv })
  })

  it('does not create a window with only the laptop', () => {
    const { controller, windows } = setup('laptop-only')
    expect(controller.open({ allowLandscape: false })).toMatchObject({ ok: false, reason: 'missing' })
    expect(windows).toHaveLength(0)
  })

  it('asks for confirmation on a landscape TV, then opens on it', () => {
    const { controller, windows } = setup('landscape-tv')
    expect(controller.open({ allowLandscape: false })).toMatchObject({ ok: false, reason: 'landscape' })
    expect(windows).toHaveLength(0)
    expect(controller.open({ allowLandscape: true })).toMatchObject({ ok: true, state: { tv: { kind: 'open', display: landscapeTv } } })
    expect(windows[0]!.place).toHaveBeenCalledWith(landscapeTv)
  })

  it('hides the window when the TV is unplugged and brings it back when it returns', () => {
    const { controller, displays, windows, states } = setup('portrait-tv')
    controller.open({ allowLandscape: false })
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

  it('keeps a confirmed landscape TV across a replug, but not after closing', () => {
    const { controller, displays, windows } = setup('landscape-tv')
    controller.open({ allowLandscape: true })
    displays.set('laptop-only')
    displays.set('landscape-tv')
    expect(controller.state().tv).toEqual({ kind: 'open', display: landscapeTv })

    controller.close()
    expect(controller.open({ allowLandscape: false })).toMatchObject({ ok: false, reason: 'landscape' })
    expect(windows).toHaveLength(1)
  })

  it('broadcasts monitor changes while the TV window is closed', () => {
    const { displays, states } = setup('laptop-only')
    displays.set('portrait-tv')
    expect(states.at(-1)).toEqual({ guest: { kind: 'portrait', display: tv }, tv: { kind: 'closed' } })
  })

  it('close destroys the window and reports closed', () => {
    const { controller, windows, states } = setup('portrait-tv')
    controller.open({ allowLandscape: false })
    expect(controller.close().tv).toEqual({ kind: 'closed' })
    expect(windows[0]!.destroy).toHaveBeenCalledTimes(1)
    expect(states.filter((state) => state.tv.kind === 'closed')).toHaveLength(1)
  })

  it('reports closed when the window goes away on its own (app quit)', () => {
    const { controller, windows, states } = setup('portrait-tv')
    controller.open({ allowLandscape: false })
    windows[0]!.closeExternally()
    expect(controller.state().tv).toEqual({ kind: 'closed' })
    expect(states.at(-1)?.tv).toEqual({ kind: 'closed' })
  })

  it('does not re-place the window when a monitor event leaves the TV unchanged', () => {
    const { controller, displays, windows } = setup('portrait-tv')
    controller.open({ allowLandscape: false })
    displays.set('portrait-tv')
    expect(windows[0]!.place).toHaveBeenCalledTimes(1)
  })
})
