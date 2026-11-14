import { test } from './fixtures'

// PRD scenarios whose screens do not exist yet. Each becomes a real test in the PR that builds its screen.
test.describe('create event', () => {
  test.fixme('RF01 accepts a 1844×1240 template for the selected mode and enables Iniciar evento', async () => {})
  test.fixme('RF01 shows the dimensions read for a template of another size and keeps Iniciar evento disabled', async () => {})
  test.fixme('RF01 keeps Iniciar evento disabled for an empty, reserved or invalid event name', async () => {})
  test.fixme('RF02 creates Desktop/<event name> on Iniciar evento', async () => {})
  test.fixme('RF02 reuses an existing event folder and keeps its files', async () => {})
  test.fixme('RF04 opens a frameless camera window on the portrait monitor', async () => {})
  test.fixme('RF04 explains that the TV was not found when there is only the laptop', async () => {})
  test.fixme('RF04 warns about a landscape TV and opens after confirmation', async () => {})
})
