import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { closeLayoutEditor, layoutEditor, startEvent, validTemplate } from './event'
import { enableShare } from './share'

/** Sets the laptop window's content size; the minimum is lowered so 900 px can be checked too. */
async function resizeLaptop(app: ElectronApplication, page: Page, width: number, height: number): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, [w, h]) => {
      const win = BrowserWindow.getAllWindows().find((candidate) => !candidate.getTitle().includes('TV'))!
      win.unmaximize()
      win.setMinimumSize(640, 480)
      win.setContentSize(w!, h!)
    },
    [width, height],
  )
  await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([width, height])
}

/** Neither the document nor the laptop page area scrolls vertically. */
async function expectNoVerticalScroll(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => {
    const main = document.querySelector('main')!
    return {
      doc: document.documentElement.scrollHeight,
      inner: window.innerHeight,
      main: main.scrollHeight,
      mainClient: main.clientHeight,
    }
  })
  expect(sizes.doc).toBeLessThanOrEqual(sizes.inner)
  expect(sizes.main).toBeLessThanOrEqual(sizes.mainClient)
}

async function rightOf(page: Page, testId: string): Promise<number> {
  const box = (await page.getByTestId(testId).boundingBox())!
  return box.x + box.width
}

/** A valid template under a very long file name, the case that pushed the preview out of the card. */
async function longNameTemplate(): Promise<string> {
  const target = join(mkdtempSync(join(tmpdir(), 'fotomagica-long-')), `${'template-da-festa-de-quinze-anos-'.repeat(4)}1844x1240.png`)
  copyFileSync(await validTemplate(), target)
  return target
}

test.describe('laptop layout fits the window', () => {
  test('at 1280×800 the home and the positions editor have no vertical scroll, and the version is in the header', async ({ app, operatorWindow }) => {
    await resizeLaptop(app, operatorWindow, 1280, 800)
    await expect(operatorWindow.locator('header').getByTestId('app-version')).toBeVisible()
    await expectNoVerticalScroll(operatorWindow)

    await operatorWindow.getByTestId('template-input').setInputFiles(await validTemplate())
    const editor = layoutEditor(operatorWindow)
    await expect(editor).toBeVisible()
    await expect(editor.getByRole('button', { name: 'Desfazer' })).toHaveCSS('height', '32px')
    await expect(editor.getByRole('button', { name: 'Concluir' })).toHaveCSS('height', '32px')
    // The sheet zoom is Ctrl + wheel only.
    await expect(editor.getByRole('button', { name: /zoom/i })).toHaveCount(0)
    const sheet = (await editor.getByTestId('layout-sheet').boundingBox())!
    const table = (await editor.getByTestId('slot-table').boundingBox())!
    expect(sheet.width).toBeGreaterThan(2 * table.width)
    const editorScroll = await editor.evaluate((node) => node.scrollHeight - node.clientHeight)
    expect(editorScroll).toBeLessThanOrEqual(0)
    await closeLayoutEditor(operatorWindow)
  })

  test('at 1280×800 with sharing on, the home has no vertical scroll and the event gallery QR footer stays pinned in the window', async ({ app, operatorWindow }) => {
    await resizeLaptop(app, operatorWindow, 1280, 800)
    await enableShare(operatorWindow)
    await expectNoVerticalScroll(operatorWindow)
    await startEvent(app, operatorWindow, { name: 'Festa' })
    const footer = operatorWindow.getByTestId('event-gallery-qr')
    await expect(footer.getByTestId('event-gallery-qr-link')).toBeVisible()
    await expect(footer.getByTestId('event-gallery-qr-wifi')).toBeVisible()
    const box = (await footer.boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(800)
    // The round screen scrolls inside <main> (as before the footer); the window itself never does.
    expect(await operatorWindow.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true)
    await operatorWindow.locator('main').evaluate((node) => node.scrollTo(0, node.scrollHeight))
    expect((await footer.boundingBox())!.y).toBe(box.y)
  })

  for (const width of [1280, 900]) {
    test(`at ${width} px the new event template column stays inside the card`, async ({ app, operatorWindow }) => {
      await resizeLaptop(app, operatorWindow, width, 800)
      await operatorWindow.getByTestId('template-input').setInputFiles(await longNameTemplate())
      await closeLayoutEditor(operatorWindow)
      await expect(operatorWindow.getByTestId('template-preview')).toBeVisible()

      const card = (await operatorWindow.getByTestId('create-event-card').boundingBox())!
      const cardRight = card.x + card.width
      for (const id of ['template-column', 'template-preview', 'template-file-name', 'template-actions']) {
        expect(await rightOf(operatorWindow, id), id).toBeLessThanOrEqual(cardRight + 0.5)
      }
      for (const name of [/Editar posições das fotos/, /Trocar template/]) {
        const box = (await operatorWindow.getByText(name).boundingBox())!
        expect(box.x + box.width).toBeLessThanOrEqual(cardRight + 0.5)
      }
      const fileName = operatorWindow.getByTestId('template-file-name')
      expect(await fileName.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
      expect(await operatorWindow.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
  }
})
