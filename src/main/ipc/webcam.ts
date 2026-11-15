import type { WebContents } from 'electron'
import { IPC_CHANNELS, type WebcamState } from '@shared/ipc'
import { readConfig, saveWebcam } from '../persist'
import type { GuestWindowController } from '../windows'
import { broadcast, handleInvoke, handleSend } from './handle'

/**
 * `webcam:*` (PRD §6.7, RF15; DESIGN §5). The values live in `config.json`, together with the
 * controls the camera last advertised, so the panel opens with the saved controls even with no
 * camera. Both windows write the same state; the TV applies it with `applyConstraints`.
 */
export function registerWebcamHandlers(deps: {
  userData: string
  tv: GuestWindowController
  isGuestWindow: (contents: WebContents) => boolean
}): void {
  let live = false

  const current = async (): Promise<WebcamState> => {
    const { webcam } = await readConfig(deps.userData)
    return { values: webcam.values, capabilities: webcam.capabilities, live }
  }
  const push = async () => broadcast(IPC_CHANNELS.webcamState, await current())

  handleInvoke(IPC_CHANNELS.webcamGet, current)

  handleInvoke(IPC_CHANNELS.webcamSet, async ({ values }) => {
    await saveWebcam(deps.userData, { values })
    const state = await current()
    broadcast(IPC_CHANNELS.webcamState, state)
    return state
  })

  handleSend(IPC_CHANNELS.webcamReport, ({ capabilities }, event) => {
    if (!deps.isGuestWindow(event.sender)) return
    live = capabilities !== null
    // A camera with no adjustable control (the E2E fixture) does not erase the controls saved from the real one.
    const keep = capabilities === null || Object.keys(capabilities.controls).length === 0
    void (keep ? Promise.resolve() : saveWebcam(deps.userData, { capabilities }).then(() => undefined))
      .then(push)
      .catch((error: unknown) => console.error('[webcam] could not save the capabilities', error))
  })

  deps.tv.onChange((state) => {
    if (state.tv.kind === 'closed' && live) {
      live = false
      void push().catch(() => {})
    }
  })
}
