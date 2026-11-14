import { test } from './fixtures'

// PRD scenarios whose screens do not exist yet. Each becomes a real test in the PR that builds its screen.
test.describe('layout editor', () => {
  test.fixme('RF03 seeds the five 2-strip slots and the three 1-strip slots', async () => {})
  test.fixme('RF03 updates Left and Top live during a drag and writes once on release', async () => {})
  test.fixme('RF03 updates Angle live during a rotation and Width/Height during a resize', async () => {})
  test.fixme('RF03 snaps at 6 px, not at 9 px, and not with Alt held', async () => {})
  test.fixme('RF03 snaps rotation within 4 degrees of 0, 90, 180 and 270', async () => {})
  test.fixme('RF03 keeps the two layouts independent across a restart', async () => {})
})
