import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { closeLayoutEditor, layoutEditor, validTemplate } from './event'

const SHEET_WIDTH = 1844

/** Imports a valid template for `mode`; the editor opens on its own. */
async function importTemplate(operatorWindow: Page, mode: '2 tiras' | '1 tira' = '2 tiras'): Promise<Locator> {
  await operatorWindow.getByRole('radio', { name: new RegExp(mode) }).check()
  await operatorWindow.getByTestId('template-input').setInputFiles(await validTemplate())
  const editor = layoutEditor(operatorWindow)
  await expect(editor).toBeVisible()
  await expect(editor.getByAltText(`Template do modo ${mode}`)).toBeVisible()
  return editor
}

/** Screen pixels per sheet pixel, and the sheet's on-screen origin. */
async function sheetScale(editor: Locator) {
  const box = (await editor.getByTestId('layout-sheet').boundingBox())!
  return { ...box, scale: box.width / SHEET_WIDTH }
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const readConfig = (userData: string) => readFileSync(join(userData, 'config.json'), 'utf8')
const numberOf = async (field: Locator) => Number(await field.inputValue())

test.describe('layout editor (RF03)', () => {
  test('RF03 importing the template opens the editor with the five 2-strip cards, and the 1-strip layout has three', async ({ operatorWindow }) => {
    const editor = await importTemplate(operatorWindow)
    const cards = editor.getByRole('button', { name: /^(Cima|Baixo) \d, foto \d$/ })
    await expect(cards).toHaveText(['1', '2', '3', '1', '2'])
    await expect(editor.getByLabel('Angle de Cima 3')).toHaveValue('270')
    await expect(editor.getByLabel('Left de Baixo 2')).toHaveValue('708')
    await expect(editor.getByTestId('cut-line')).toBeVisible()
    // Cima 1 at Angle 270 is drawn tall, Baixo 1 at Angle 0 lying down.
    const top1 = (await editor.getByTestId('slot-card-top-1').boundingBox())!
    const bottom1 = (await editor.getByTestId('slot-card-bottom-1').boundingBox())!
    expect(top1.height).toBeGreaterThan(top1.width)
    expect(bottom1.width).toBeGreaterThan(bottom1.height)

    await editor.getByRole('radio', { name: '1 tira' }).click()
    await expect(editor.getByRole('button', { name: /^Foto \d, foto \d$/ })).toHaveCount(3)
    await expect(editor.getByTestId('cut-line')).toHaveCount(0)
  })

  test('RF03 updates Left and Top live during a drag and writes once on release', async ({ operatorWindow, dirs }) => {
    const editor = await importTemplate(operatorWindow)
    const { scale } = await sheetScale(editor)
    const left = editor.getByLabel('Left de Baixo 1')
    const top = editor.getByLabel('Top de Baixo 1')
    const start = await center(editor.getByTestId('slot-card-bottom-1'))
    const before = readConfig(dirs.userData)

    await operatorWindow.mouse.move(start.x, start.y)
    await operatorWindow.mouse.down()
    // 30 px right and 40 px up on the sheet, in a few steps: Left ≈ 92, Top ≈ 693, clear of snap targets.
    await operatorWindow.mouse.move(start.x + 30 * scale, start.y - 40 * scale, { steps: 8 })
    await expect.poll(() => numberOf(left)).toBeGreaterThan(86)
    expect(Math.abs((await numberOf(left)) - 92)).toBeLessThanOrEqual(3)
    expect(Math.abs((await numberOf(top)) - 693)).toBeLessThanOrEqual(3)
    expect(readConfig(dirs.userData)).toBe(before)

    await operatorWindow.mouse.up()
    await expect(editor.getByTestId('layout-save-state')).toHaveText('Salvo')
    const saved = JSON.parse(readConfig(dirs.userData)).layouts['two-strips'].find((slot: { id: string }) => slot.id === 'bottom-1')
    expect(saved.left).toBe(await numberOf(left))
    expect(saved.top).toBe(await numberOf(top))
  })

  test('RF03 snaps to the sheet edge at 6 px, and not with Alt held', async ({ operatorWindow }) => {
    const editor = await importTemplate(operatorWindow)
    const { scale } = await sheetScale(editor)
    const left = editor.getByLabel('Left de Baixo 1')
    const start = await center(editor.getByTestId('slot-card-bottom-1'))
    await operatorWindow.mouse.move(start.x, start.y)
    await operatorWindow.mouse.down()
    // Baixo 1 starts at Left 62: 56 px left puts it 6 px from the sheet edge.
    await operatorWindow.mouse.move(start.x - 56 * scale, start.y, { steps: 6 })
    await expect(left).toHaveValue('0')
    await operatorWindow.keyboard.down('Alt')
    await operatorWindow.mouse.move(start.x - 56 * scale, start.y + 1)
    await expect.poll(() => numberOf(left)).toBeGreaterThan(2)
    expect(Math.abs((await numberOf(left)) - 6)).toBeLessThanOrEqual(3)
    await operatorWindow.mouse.up()
    await operatorWindow.keyboard.up('Alt')
  })

  test('RF03 updates Angle live during a rotation and Width/Height during a resize', async ({ operatorWindow }) => {
    const editor = await importTemplate(operatorWindow)
    const { scale } = await sheetScale(editor)
    const card = editor.getByTestId('slot-card-bottom-1')
    await card.click()
    // The sheet fits the window after the editor opens; on a loaded run it can still be resizing here,
    // so read the card only once two reads in a row agree.
    let middle = await center(card)
    await expect
      .poll(async () => {
        const next = await center(card)
        const settled = Math.abs(next.x - middle.x) < 0.5 && Math.abs(next.y - middle.y) < 0.5
        middle = next
        return settled
      })
      .toBe(true)

    const knob = await center(editor.getByTestId('handle-rotate'))
    await operatorWindow.mouse.move(knob.x, knob.y)
    await operatorWindow.mouse.down()
    // Pointer straight left of the center: the handle points at 90°.
    await operatorWindow.mouse.move(middle.x - 200 * scale, middle.y + 2, { steps: 6 })
    await expect(editor.getByLabel('Angle de Baixo 1')).toHaveValue('90')
    await operatorWindow.mouse.move(middle.x, middle.y + 200 * scale, { steps: 6 })
    await expect(editor.getByLabel('Angle de Baixo 1')).toHaveValue('0')
    await operatorWindow.mouse.up()

    const corner = await center(editor.getByTestId('handle-se'))
    await operatorWindow.mouse.move(corner.x, corner.y)
    await operatorWindow.mouse.down()
    await operatorWindow.mouse.move(corner.x - 30 * scale, corner.y - 30 * scale, { steps: 6 })
    await expect.poll(() => numberOf(editor.getByLabel('Width de Baixo 1'))).toBeLessThan(590)
    expect(await numberOf(editor.getByLabel('Height de Baixo 1'))).toBeLessThan(392)
    await operatorWindow.mouse.up()
  })

  test('RF03 a number typed in the panel moves the card', async ({ operatorWindow }) => {
    const editor = await importTemplate(operatorWindow)
    const { x, scale } = await sheetScale(editor)
    const card = editor.getByTestId('slot-card-bottom-1')
    await editor.getByLabel('Left de Baixo 1').fill('1000')
    await editor.getByLabel('Left de Baixo 1').press('Enter')
    await expect.poll(async () => Math.round(((await card.boundingBox())!.x - x) / scale)).toBeGreaterThan(995)
    expect(Math.abs(((await card.boundingBox())!.x - x) / scale - 1000)).toBeLessThan(5)
    await expect(editor.getByTestId('layout-save-state')).toHaveText('Salvo')
  })

  test('RF03 keeps the two layouts independent across a restart, and an event uses its own', async ({ operatorWindow, dirs, relaunch }) => {
    let editor = await importTemplate(operatorWindow)
    await editor.getByLabel('Left de Baixo 1').fill('90')
    await editor.getByLabel('Left de Baixo 1').press('Enter')
    await editor.getByLabel('Imagem de Cima 3').selectOption('Nenhuma')
    await expect(editor.getByTestId('layout-save-state')).toHaveText('Salvo')
    const oneStripBefore = JSON.parse(readConfig(dirs.userData)).layouts['one-strip']

    await editor.getByRole('radio', { name: '1 tira' }).click()
    await editor.getByLabel('Top de Foto 2').fill('60')
    await editor.getByLabel('Top de Foto 2').press('Enter')
    await expect(editor.getByTestId('layout-save-state')).toHaveText('Salvo')
    const saved = JSON.parse(readConfig(dirs.userData)).layouts
    expect(saved['two-strips'].find((slot: { id: string }) => slot.id === 'bottom-1').left).toBe(90)
    expect(saved['one-strip'].find((slot: { id: string }) => slot.id === 'photo-2').top).toBe(60)
    expect(oneStripBefore.find((slot: { id: string }) => slot.id === 'photo-2').top).toBe(40)

    const next = await relaunch()
    await next.operatorWindow.getByRole('button', { name: 'Editar posições das fotos (2 tiras)' }).click()
    editor = layoutEditor(next.operatorWindow)
    await expect(editor.getByLabel('Left de Baixo 1')).toHaveValue('90')
    await expect(editor.getByRole('button', { name: 'Cima 3, sem foto' })).toBeVisible()
    await editor.getByRole('radio', { name: '1 tira' }).click()
    await expect(editor.getByLabel('Top de Foto 2')).toHaveValue('60')
    await expect(editor.getByLabel('Top de Foto 1')).toHaveValue('40')
    await closeLayoutEditor(next.operatorWindow)

    // The 2 tiras event takes the edited 2-strip layout.
    await next.operatorWindow.getByLabel('Nome do evento').fill('Festa')
    await expect(next.operatorWindow.getByTestId('template-preview')).toBeVisible()
    const opened = next.app.waitForEvent('window')
    await next.operatorWindow.getByRole('button', { name: 'Iniciar evento' }).click()
    await opened
    // The TV window opens before main creates the folder and starts the session, so wait for the state.
    await expect.poll(async () => (await next.operatorWindow.evaluate(() => window.fotomagica.session.getState())).kind).toBe('event')
    const state = await next.operatorWindow.evaluate(() => window.fotomagica.session.getState())
    expect(state.kind).toBe('event')
    if (state.kind !== 'event') return
    expect(state.slots.find((slot) => slot.id === 'bottom-1')?.left).toBe(90)
    expect(state.slots.find((slot) => slot.id === 'top-3')?.photo).toBeNull()
    // No editor while the event runs (PRD §6.3).
    await expect(next.operatorWindow.getByRole('button', { name: /Editar posições das fotos/ })).toHaveCount(0)
  })
})
