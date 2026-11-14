import { test } from './fixtures'

// PRD scenarios whose screens do not exist yet. Each becomes a real test in the PR that builds its screen.
test.describe('print', () => {
  test.fixme('RF10 Mais stops at 10 and Menos stops at 1', async () => {})
  test.fixme('RF11 2 tiras writes a simulated ticket with cut on', async () => {})
  test.fixme('RF11 1 tira writes a simulated ticket with cut off', async () => {})
  test.fixme('RF11 reports cut-unavailable and does not treat the sheet as printed', async () => {})
  test.fixme('RF12 saves a single HH-mm-ss.jpg montage of 1844×1240 at 300 DPI', async () => {})
  test.fixme('RF13 Imprimir novamente resends the same JPG without a new file', async () => {})
  test.fixme('RF13 Nova rodada returns to the camera at 1/3', async () => {})
  test.fixme('RNF10 printer offline, no paper or no ribbon keeps the round and shows the state', async () => {})
})
