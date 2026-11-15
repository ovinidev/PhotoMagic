import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { stubBridge } from '@renderer/test/bridge'
import { GalleryPanel } from './GalleryPanel'

describe('GalleryPanel (RF14)', () => {
  it('shows the empty state', async () => {
    stubBridge()
    render(<GalleryPanel />)
    expect(await screen.findByText('Nenhuma montagem ainda')).toBeInTheDocument()
  })

  it('lists the montages, reloads on gallery:changed, and reprints one from the menu', async () => {
    const { api, pushGallery } = stubBridge({ gallery: { list: () => Promise.resolve({ fileNames: ['21-45-08.jpg'] }) } })
    render(<GalleryPanel />)
    expect(await screen.findByRole('button', { name: 'Abrir a montagem 21-45-08.jpg' })).toBeInTheDocument()

    api.gallery.list.mockResolvedValue({ fileNames: ['21-50-00.jpg', '21-45-08.jpg'] })
    pushGallery()
    expect(await screen.findByRole('button', { name: 'Abrir a montagem 21-50-00.jpg' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir a montagem 21-45-08.jpg' }))
    expect(screen.getByRole('dialog', { name: '21-45-08.jpg' })).toBeInTheDocument()
    expect(api.gallery.get).toHaveBeenCalledWith({ fileName: '21-45-08.jpg', size: 'full' })
    await userEvent.click(screen.getByRole('button', { name: 'Mais opções' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Imprimir novamente' }))
    expect(api.gallery.reprint).toHaveBeenCalledWith('21-45-08.jpg')
    await waitFor(() => expect(screen.getByTestId('gallery-reprint-status')).toHaveTextContent('Montagem enviada para a impressora'))
  })

  it('names the printer failure of a reprint', async () => {
    stubBridge({
      gallery: {
        list: () => Promise.resolve({ fileNames: ['21-45-08.jpg'] }),
        reprint: () => Promise.resolve({ ok: false as const, reason: 'no-paper' as const, detail: '' }),
      },
    })
    render(<GalleryPanel />)
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir a montagem 21-45-08.jpg' }))
    await userEvent.click(screen.getByRole('button', { name: 'Mais opções' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Imprimir novamente' }))
    await waitFor(() => expect(screen.getByTestId('gallery-reprint-status')).toHaveTextContent('Impressora sem papel'))
  })
})
