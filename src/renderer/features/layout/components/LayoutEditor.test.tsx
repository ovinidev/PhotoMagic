import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SEED_LAYOUTS } from '@shared/layout'
import { stubBridge } from '@renderer/test/bridge'
import { LayoutEditor } from './LayoutEditor'

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:template')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

// jsdom lays nothing out: the sheet's rect is 0 wide, so the canvas reads client pixels as sheet pixels.
const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', element: Element, x: number, y: number, extra: object = {}) =>
  fireEvent[type](element, { pointerId: 1, button: 0, clientX: x, clientY: y, ...extra })

const percent = (value: string) => Number.parseFloat(value)
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement

/** 2 tiras with the bottom cards lying (Angle 0), for gestures whose numbers assume an unturned card. */
const LYING_BOTTOM = { ...SEED_LAYOUTS, 'two-strips': SEED_LAYOUTS['two-strips'].map((slot) => (slot.id.startsWith('bottom-') ? { ...slot, angle: 0 } : slot)) }

async function open(mode: 'two-strips' | 'one-strip' = 'two-strips', layouts = SEED_LAYOUTS) {
  const bridge = stubBridge({ layout: { get: () => Promise.resolve(layouts) } })
  render(<LayoutEditor initialMode={mode} onClose={() => {}} />)
  await screen.findByTestId('layout-sheet')
  return bridge
}

describe('LayoutEditor (RF03)', () => {
  it('shows the five 2-strip cards with their photo numbers and the table of numbers', async () => {
    await open()
    const cards = screen.getAllByRole('button', { name: /^(Cima|Baixo) \d, foto \d$/ })
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Cima 1, foto 1',
      'Cima 2, foto 2',
      'Cima 3, foto 3',
      'Baixo 1, foto 1',
      'Baixo 2, foto 2',
    ])
    expect(field('Left de Baixo 2').value).toBe('708')
    expect(field('Angle de Cima 3').value).toBe('270')
    expect(screen.getByTestId('cut-line')).toBeInTheDocument()
  })

  it('switches to the 1-strip layout, three cards and no cut line', async () => {
    await open()
    await userEvent.click(screen.getByRole('radio', { name: '1 tira' }))
    expect(screen.getAllByRole('button', { name: /^Foto \d, foto \d$/ })).toHaveLength(3)
    expect(screen.queryByTestId('cut-line')).not.toBeInTheDocument()
    expect(field('Width de Foto 1').value).toBe('560')
  })

  it('updates Left and Top during the drag, and saves once on release', async () => {
    const { api } = await open()
    const card = screen.getByTestId('slot-card-bottom-1')
    const sheet = screen.getByTestId('layout-sheet')
    pointer('pointerDown', card, 300, 800)
    pointer('pointerMove', sheet, 340, 780)
    // Left 92, Top 693: clear of every snap target.
    pointer('pointerMove', sheet, 330, 760)
    expect(field('Left de Baixo 1').value).toBe('92')
    expect(field('Top de Baixo 1').value).toBe('693')
    expect(percent(card.style.left)).toBeCloseTo((92 / 1844) * 100, 3)
    expect(api.layout.save).not.toHaveBeenCalled()

    pointer('pointerUp', sheet, 330, 760)
    await waitFor(() => expect(api.layout.save).toHaveBeenCalledTimes(1))
    const saved = api.layout.save.mock.calls[0]![0]
    expect(saved.mode).toBe('two-strips')
    expect(saved.slots.find((slot) => slot.id === 'bottom-1')).toMatchObject({ left: 92, top: 693 })
    expect(saved.slots.find((slot) => slot.id === 'top-1')).toEqual(SEED_LAYOUTS['two-strips'][0])
  })

  it('snaps to the sheet edge at 6 px, and not with Alt held', async () => {
    await open('two-strips', LYING_BOTTOM)
    const card = screen.getByTestId('slot-card-bottom-1')
    const sheet = screen.getByTestId('layout-sheet')
    pointer('pointerDown', card, 300, 800)
    pointer('pointerMove', sheet, 300 - 56, 800) // Left 6
    expect(field('Left de Baixo 1').value).toBe('0')
    pointer('pointerMove', sheet, 300 - 56, 800, { altKey: true })
    expect(field('Left de Baixo 1').value).toBe('6')
    pointer('pointerUp', sheet, 300 - 56, 800, { altKey: true })
  })

  it('rotates from the rotation handle with the angle live in the panel', async () => {
    await open()
    await userEvent.click(screen.getByTestId('slot-card-bottom-1'))
    const sheet = screen.getByTestId('layout-sheet')
    // Center of Baixo 1: 363, 934. A pointer to its left points the handle at 90°.
    pointer('pointerDown', screen.getByTestId('handle-rotate'), 363, 1180)
    pointer('pointerMove', sheet, 100, 939)
    expect(field('Angle de Baixo 1').value).toBe('90')
    pointer('pointerUp', sheet, 100, 939)
  })

  it('resizes from a handle with Width and Height live', async () => {
    await open('two-strips', LYING_BOTTOM)
    await userEvent.click(screen.getByTestId('slot-card-bottom-1'))
    const sheet = screen.getByTestId('layout-sheet')
    pointer('pointerDown', screen.getByTestId('handle-se'), 664, 1135)
    pointer('pointerMove', sheet, 644, 1105)
    expect(field('Width de Baixo 1').value).toBe('582')
    expect(field('Height de Baixo 1').value).toBe('372')
    pointer('pointerUp', sheet, 644, 1105)
  })

  it('moves the card when a number is typed, and saves on Enter', async () => {
    const { api } = await open()
    const left = field('Left de Baixo 1')
    await userEvent.clear(left)
    await userEvent.type(left, '90')
    expect(percent(screen.getByTestId('slot-card-bottom-1').style.left)).toBeCloseTo((90 / 1844) * 100, 3)
    expect(api.layout.save).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(api.layout.save).toHaveBeenCalledTimes(1))
    expect(api.layout.save.mock.calls[0]![0].slots.find((slot) => slot.id === 'bottom-1')?.left).toBe(90)
  })

  it('assigns a photo or Nenhuma from the Image column', async () => {
    const { api } = await open()
    await userEvent.selectOptions(screen.getByLabelText('Imagem de Cima 3'), 'Nenhuma')
    expect(screen.getByRole('button', { name: 'Cima 3, sem foto' })).toBeInTheDocument()
    await waitFor(() => expect(api.layout.save).toHaveBeenCalled())
    expect(api.layout.save.mock.calls.at(-1)![0].slots.find((slot) => slot.id === 'top-3')?.photo).toBeNull()
    await userEvent.selectOptions(screen.getByLabelText('Imagem de Cima 3'), '1')
    expect(screen.getByRole('button', { name: 'Cima 3, foto 1' })).toBeInTheDocument()
  })

  it('undoes, redoes and resets to the seed, saving each step', async () => {
    const { api } = await open()
    const left = field('Left de Baixo 1')
    await userEvent.clear(left)
    await userEvent.type(left, '90{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(field('Left de Baixo 1').value).toBe('62')
    await userEvent.click(screen.getByRole('button', { name: 'Refazer' }))
    expect(field('Left de Baixo 1').value).toBe('90')
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }))
    expect(field('Left de Baixo 1').value).toBe('62')
    await waitFor(() => expect(api.layout.save).toHaveBeenCalledTimes(4))
  })

  it('warns when a slot crosses the cut line, only in 2 tiras', async () => {
    await open()
    expect(screen.queryByTestId('cut-warning')).not.toBeInTheDocument()
    const top = field('Top de Baixo 1')
    await userEvent.clear(top)
    await userEvent.type(top, '600{Enter}')
    expect(await screen.findByTestId('cut-warning')).toHaveTextContent('Baixo 1 cruza a linha de corte (y = 620).')
  })

  it('reports a save refused because an event is open', async () => {
    stubBridge({ layout: { save: () => Promise.resolve({ ok: false, reason: 'event-open' }) } })
    render(<LayoutEditor initialMode="two-strips" onClose={() => {}} />)
    const left = (await screen.findByLabelText('Left de Baixo 1')) as HTMLInputElement
    await userEvent.clear(left)
    await userEvent.type(left, '90{Enter}')
    expect(await screen.findByText('Encerre o evento para mudar as posições.')).toBeInTheDocument()
  })

  it('shows loading, then an error when the layouts cannot be read', async () => {
    stubBridge({ layout: { get: () => Promise.reject(new Error('ipc down')) } })
    render(<LayoutEditor initialMode="two-strips" onClose={() => {}} />)
    expect(screen.getByText('Carregando posições…')).toBeInTheDocument()
    expect(await screen.findByText('Não foi possível ler as posições salvas.')).toBeInTheDocument()
  })

  it('keeps every card number upright, whatever the card angle (client, 2026-11-28)', async () => {
    await open()
    expect(screen.getByTestId('slot-number-top-1').style.transform).toBe('rotate(-270deg)')
    expect(screen.getByTestId('slot-number-bottom-1').style.transform).toBe('rotate(-270deg)')
    await userEvent.click(screen.getByTestId('slot-card-bottom-1'))
    const sheet = screen.getByTestId('layout-sheet')
    pointer('pointerDown', screen.getByTestId('handle-rotate'), 363, 1180)
    pointer('pointerMove', sheet, 100, 939)
    // Live, during the gesture: the card turns by 90°, its number turns back.
    expect(screen.getByTestId('slot-number-bottom-1').style.transform).toBe('rotate(-90deg)')
    pointer('pointerUp', sheet, 100, 939)
  })

  it('lists the fixed gray boxes in their own table and saves a moved box with boxes:save only (DESIGN §6)', async () => {
    const { api } = await open()
    expect(within(screen.getByTestId('box-table')).getAllByRole('row')).toHaveLength(6)
    const left = field('Left de Quadro cinza Baixo 2')
    expect(left.value).toBe('708')
    await userEvent.clear(left)
    await userEvent.type(left, '750{Enter}')
    expect(percent(screen.getByTestId('fixed-box-bottom-2').style.left)).toBeCloseTo((750 / 1844) * 100, 3)
    await waitFor(() => expect(api.layout.saveBoxes).toHaveBeenCalledTimes(1))
    const saved = api.layout.saveBoxes.mock.calls[0]![0]
    expect(saved.mode).toBe('two-strips')
    expect(saved.boxes).toHaveLength(5)
    expect(saved.boxes.find((box) => box.id === 'bottom-2')?.rect).toEqual({ left: 750, top: 733, width: 602, height: 402 })
    expect(api.layout.save).not.toHaveBeenCalled()
  })

  it('drags a gray box on the sheet once Quadros cinza is picked, the cards letting the pointer through', async () => {
    const { api } = await open()
    await userEvent.click(screen.getByRole('radio', { name: 'Quadros cinza' }))
    expect(screen.getByTestId('slot-card-bottom-1').className).toContain('pointer-events-none')
    const sheet = screen.getByTestId('layout-sheet')
    pointer('pointerDown', screen.getByTestId('fixed-box-bottom-1'), 300, 800)
    pointer('pointerMove', sheet, 330, 760)
    pointer('pointerUp', sheet, 330, 760)
    await waitFor(() => expect(api.layout.saveBoxes).toHaveBeenCalledTimes(1))
    expect(api.layout.saveBoxes.mock.calls[0]![0].boxes.find((box) => box.id === 'bottom-1')?.rect).toMatchObject({ left: 92, top: 693 })
  })

  it('undoes a box move and Restaurar padrão puts the boxes back on the defaults', async () => {
    const { api } = await open()
    const top = field('Top de Quadro cinza Cima 1')
    await userEvent.clear(top)
    await userEvent.type(top, '80{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(field('Top de Quadro cinza Cima 1').value).toBe('44')
    await userEvent.click(screen.getByRole('button', { name: 'Refazer' }))
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar padrão' }))
    expect(field('Top de Quadro cinza Cima 1').value).toBe('44')
    await waitFor(() => expect(api.layout.saveBoxes).toHaveBeenCalledTimes(4))
  })

  it('closes on Concluir and on Escape', async () => {
    stubBridge()
    const onClose = vi.fn()
    render(<LayoutEditor initialMode="two-strips" onClose={onClose} />)
    const dialog = await screen.findByRole('dialog', { name: 'Posições das fotos' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Concluir' }))
    act(() => void fireEvent.keyDown(window, { key: 'Escape' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
