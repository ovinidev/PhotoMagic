import { test } from './fixtures'

// PRD scenarios whose screens do not exist yet. Each becomes a real test in the PR that builds its screen.
test.describe('capture round', () => {
  test.fixme('RF05 shows the fixture frame mirrored and upright on the TV', async () => {})
  test.fixme('RF06 advances the counter 1/3, 2/3, 3/3 and moves to printing', async () => {})
  test.fixme('RF06 laptop shutter triggers the same capture as the TV button', async () => {})
  test.fixme('RF07 counts down 5 s and 10 s before capturing', async () => {})
  test.fixme('RF07 syncs the timer between the TV and the laptop', async () => {})
  test.fixme('RF09 frames a slot without moving it and keeps shared captures independent', async () => {})
  test.fixme('RF10 Cancelar returns to the camera at 1/3 with no file', async () => {})
})
