import { app, session, type WebContents } from 'electron'
import type { RuntimeFlags } from '@shared/runtime'
import { allowPermission, cameraFixtureSwitches } from './policy'

/** Under E2E, swaps the webcam for Chromium's fake device. Must run before `app` is ready. */
export function applyCameraFixture(flags: RuntimeFlags): void {
  if (!flags.e2e) return
  for (const [name, value] of cameraFixtureSwitches(flags.fixtures.camera)) {
    if (value === undefined) app.commandLine.appendSwitch(name)
    else app.commandLine.appendSwitch(name, value)
  }
}

/** Grants the camera to the TV window only and denies every other permission request or check. */
export function restrictPermissions(isGuestWindow: (contents: WebContents | null) => boolean): void {
  const { defaultSession } = session
  defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined
    callback(allowPermission({ permission, fromGuestWindow: isGuestWindow(contents), mediaTypes }))
  })
  defaultSession.setPermissionCheckHandler((contents, permission) =>
    allowPermission({ permission, fromGuestWindow: isGuestWindow(contents) }),
  )
}
