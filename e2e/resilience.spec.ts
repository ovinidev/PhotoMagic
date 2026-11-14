import { test } from './fixtures'

// PRD scenarios whose screens do not exist yet. Each becomes a real test in the PR that builds its screen.
test.describe('resilience', () => {
  test.fixme('RNF10 keeps the photos and accepts touch when the webcam disappears mid-round', async () => {})
  test.fixme('RF16 Encerrar evento closes the TV and returns to the home screen', async () => {})
  test.fixme('RF15 webcam panel opens with persisted controls in fixture mode', async () => {})
})
