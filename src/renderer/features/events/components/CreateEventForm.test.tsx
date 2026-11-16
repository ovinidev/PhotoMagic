import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DisplayState, TemplateInfo, Templates } from '@shared/ipc'
import { stubBridge } from '@renderer/test/bridge'
import { CreateEventForm } from './CreateEventForm'

const tv = { id: 2, primary: false, x: 1920, y: 0, width: 1080, height: 1920 }
const PORTRAIT: DisplayState = { guest: { kind: 'portrait', display: tv }, tv: { kind: 'closed' } }
const LANDSCAPE: DisplayState = { guest: { kind: 'landscape-external', display: { ...tv, width: 1920, height: 1080 } }, tv: { kind: 'closed' } }
const info = (mode: TemplateInfo['mode'], fileName: string): TemplateInfo => ({ mode, fileName, width: 1844, height: 1240, preview: new Uint8Array([1]) })
const WITH_TWO_STRIPS: Templates = { 'two-strips': info('two-strips', 'Festa.png'), 'one-strip': null }

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

const start = () => screen.getByRole('button', { name: 'Iniciar evento' })
const file = (name: string) => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })

describe('CreateEventForm (RF01, RF04)', () => {
  it('enables Iniciar evento with a valid name, the mode template and a portrait TV, and starts the event', async () => {
    const { api } = stubBridge({
      display: { getState: () => Promise.resolve(PORTRAIT) },
      template: { getAll: () => Promise.resolve(WITH_TWO_STRIPS) },
    })
    render(<CreateEventForm />)
    expect(await screen.findByAltText('Template do modo 2 tiras')).toBeInTheDocument()
    expect(start()).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Nome do evento'), 'Aniversário AJ')
    expect(screen.getByText('As montagens ficam na Área de Trabalho, na pasta Aniversário AJ.')).toBeInTheDocument()
    await waitFor(() => expect(start()).toBeEnabled())
    await userEvent.click(start())
    expect(api.event.start).toHaveBeenCalledWith({ name: 'Aniversário AJ', mode: 'two-strips', allowLandscape: false })
  })

  it('starts with no template on the plain white default sheet with the standard boxes (PRD §6.1)', async () => {
    const { api } = stubBridge({ display: { getState: () => Promise.resolve(PORTRAIT) } })
    render(<CreateEventForm />)
    const sheet = await screen.findByTestId('template-default')
    expect(sheet.querySelectorAll('rect')).toHaveLength(5)
    expect(screen.getByText('Fundo branco (padrão) · 1844 × 1240 px')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nome do evento'), 'Festa')
    await waitFor(() => expect(start()).toBeEnabled())
    await userEvent.click(start())
    expect(api.event.start).toHaveBeenCalledWith({ name: 'Festa', mode: 'two-strips', allowLandscape: false })
  })

  it.each([
    ['   ', null],
    ['CON', 'Esse nome é reservado pelo Windows. Escolha outro.'],
    ['Festa: 15', 'O nome não pode ter \\ / : * ? " < > |'],
  ])('keeps Iniciar evento disabled for the name %j', async (name, message) => {
    stubBridge({ display: { getState: () => Promise.resolve(PORTRAIT) }, template: { getAll: () => Promise.resolve(WITH_TWO_STRIPS) } })
    render(<CreateEventForm />)
    await userEvent.type(screen.getByLabelText('Nome do evento'), name)
    if (message) expect(screen.getByText(message)).toBeInTheDocument()
    expect(start()).toBeDisabled()
  })

  it('shows the size read for a wrong template and keeps Iniciar evento disabled', async () => {
    const { api } = stubBridge({
      display: { getState: () => Promise.resolve(PORTRAIT) },
      template: { import: () => Promise.resolve({ ok: false as const, reason: 'size' as const, width: 1200, height: 1800 }) },
    })
    render(<CreateEventForm />)
    expect(await screen.findByTestId('template-default')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nome do evento'), 'Festa')
    await userEvent.upload(screen.getByTestId('template-input'), file('errado.png'))
    expect(await screen.findByText('O arquivo tem 1200 × 1800 px. O template precisa ter 1844 × 1240 px.')).toBeInTheDocument()
    expect(api.template.import).toHaveBeenCalledWith(expect.objectContaining({ mode: 'two-strips', fileName: 'errado.png' }))
    expect(start()).toBeDisabled()
  })

  it('imports into the selected mode only and keeps the other mode template', async () => {
    const { api } = stubBridge({
      display: { getState: () => Promise.resolve(PORTRAIT) },
      template: {
        getAll: () => Promise.resolve(WITH_TWO_STRIPS),
        import: () => Promise.resolve({ ok: true as const, template: info('one-strip', 'Inteira.png') }),
      },
    })
    render(<CreateEventForm />)
    await screen.findByAltText('Template do modo 2 tiras')
    await userEvent.click(screen.getByRole('radio', { name: /1 tira/ }))
    expect(screen.getByTestId('template-default')).toBeInTheDocument()
    await userEvent.upload(screen.getByTestId('template-input'), file('Inteira.png'))
    expect(await screen.findByText('Inteira.png · 1844 × 1240 px')).toBeInTheDocument()
    expect(api.template.import).toHaveBeenCalledWith(expect.objectContaining({ mode: 'one-strip' }))

    await userEvent.click(screen.getByRole('radio', { name: /2 tiras/ }))
    expect(screen.getByText('Festa.png · 1844 × 1240 px')).toBeInTheDocument()
  })

  it('opens the slot editor for the mode right after a template is accepted, and from its button', async () => {
    stubBridge({
      template: { import: () => Promise.resolve({ ok: true as const, template: info('one-strip', 'Inteira.png') }) },
    })
    const onEditLayout = vi.fn()
    render(<CreateEventForm onEditLayout={onEditLayout} />)
    await screen.findByTestId('template-default')
    await userEvent.click(screen.getByRole('radio', { name: /1 tira/ }))
    await userEvent.upload(screen.getByTestId('template-input'), file('Inteira.png'))
    await waitFor(() => expect(onEditLayout).toHaveBeenCalledWith('one-strip'))

    await userEvent.click(screen.getByRole('radio', { name: /2 tiras/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Editar posições das fotos (2 tiras)' }))
    expect(onEditLayout).toHaveBeenLastCalledWith('two-strips')
  })

  it('does not open the editor for a rejected template', async () => {
    stubBridge({ template: { import: () => Promise.resolve({ ok: false as const, reason: 'format' as const }) } })
    const onEditLayout = vi.fn()
    render(<CreateEventForm onEditLayout={onEditLayout} />)
    await screen.findByTestId('template-default')
    await userEvent.upload(screen.getByTestId('template-input'), file('errado.png'))
    expect(await screen.findByText('Use um arquivo PNG ou JPG.')).toBeInTheDocument()
    expect(onEditLayout).not.toHaveBeenCalled()
  })

  it('explains a missing TV and keeps Iniciar evento disabled', async () => {
    stubBridge({ template: { getAll: () => Promise.resolve(WITH_TWO_STRIPS) } })
    render(<CreateEventForm />)
    await userEvent.type(screen.getByLabelText('Nome do evento'), 'Festa')
    expect(await screen.findByText('TV não encontrada')).toBeInTheDocument()
    expect(start()).toBeDisabled()
  })

  it('asks for confirmation before opening on a landscape TV', async () => {
    const { api } = stubBridge({ display: { getState: () => Promise.resolve(LANDSCAPE) }, template: { getAll: () => Promise.resolve(WITH_TWO_STRIPS) } })
    render(<CreateEventForm />)
    await userEvent.type(screen.getByLabelText('Nome do evento'), 'Festa')
    expect(await screen.findByText('A TV não está na vertical')).toBeInTheDocument()
    expect(start()).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Abrir a câmera na TV mesmo na horizontal' }))
    await userEvent.click(start())
    expect(api.event.start).toHaveBeenCalledWith({ name: 'Festa', mode: 'two-strips', allowLandscape: true })
  })

  it('shows why main refused to start', async () => {
    stubBridge({
      display: { getState: () => Promise.resolve(PORTRAIT) },
      template: { getAll: () => Promise.resolve(WITH_TWO_STRIPS) },
      event: { start: () => Promise.resolve({ ok: false as const, reason: 'folder-failed' as const }) },
    })
    render(<CreateEventForm />)
    await screen.findByAltText('Template do modo 2 tiras')
    await userEvent.type(screen.getByLabelText('Nome do evento'), 'Festa')
    await userEvent.click(start())
    expect(await screen.findByText('Não foi possível criar a pasta na Área de Trabalho.')).toBeInTheDocument()
  })
})
