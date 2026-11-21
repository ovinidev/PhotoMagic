import { expect, test } from './fixtures'
import { PRINT_TIMEOUT, startEvent, takePhotos } from './event'
import { E2E_SHARE_PORT, enableShare } from './share'

test.describe('offline photo download (DESIGN §17)', () => {
  test('after Imprimir the TV shows the Wi-Fi and photo QR codes, and the link serves the montage', async ({ app, operatorWindow }) => {
    await enableShare(operatorWindow, { ssid: 'Festa;1', password: 'a:b' })
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })
    await takePhotos(tv, 3)
    await expect(tv.getByTestId('share-qr')).toHaveCount(0)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })

    await expect(tv.getByText('1. Conecte-se ao Wi-Fi')).toBeVisible()
    await expect(tv.getByText('2. Escaneie para baixar')).toBeVisible()
    await expect(tv.getByTestId('share-qr-wifi')).toHaveAttribute('data-qr-text', String.raw`WIFI:T:WPA;S:Festa\;1;P:a\:b;;`)
    await expect(tv.getByTestId('share-qr-link').locator('img')).toBeVisible()
    const url = await tv.getByTestId('share-qr-link').getAttribute('data-qr-text')
    expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${E2E_SHARE_PORT}/p/[A-Za-z0-9_-]{22}$`))

    const page = await fetch(url!)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('Baixar foto')
    const photo = await fetch(`${url}/foto.jpg`)
    expect(photo.headers.get('content-type')).toBe('image/jpeg')
    expect((await photo.arrayBuffer()).byteLength).toBeGreaterThan(10_000)
    expect((await fetch(`http://127.0.0.1:${E2E_SHARE_PORT}/`)).status).toBe(404)

    // A new round takes the link off the TV; the phone that has it can still download.
    await tv.getByRole('button', { name: 'Nova rodada' }).click()
    await expect(tv.getByTestId('share-qr')).toHaveCount(0)
    expect((await fetch(url!)).status).toBe(200)
  })
  test('during an event the laptop shows the event gallery QR, and the gallery lists the montage until Encerrar evento', async ({ app, operatorWindow }) => {
    await enableShare(operatorWindow, { ssid: 'Festa', password: 'festa2026' })
    await expect(operatorWindow.getByTestId('event-gallery-qr')).toHaveCount(0)
    const tv = await startEvent(app, operatorWindow, { name: 'Festa' })

    const footer = operatorWindow.getByTestId('event-gallery-qr')
    await expect(footer).toBeVisible()
    await expect(footer.getByTestId('event-gallery-qr-wifi')).toHaveAttribute('data-qr-text', 'WIFI:T:WPA;S:Festa;P:festa2026;;')
    const url = await footer.getByTestId('event-gallery-qr-link').getAttribute('data-qr-text')
    expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:${E2E_SHARE_PORT}/e/[A-Za-z0-9_-]{22}$`))
    expect(await (await fetch(url!)).text()).toContain('Ainda não há fotos')

    await takePhotos(tv, 3)
    await tv.getByRole('button', { name: 'Imprimir' }).click()
    await expect(tv.getByTestId('print-screen')).toHaveAttribute('data-phase', 'printed', { timeout: PRINT_TIMEOUT })
    // The guest QR codes on the TV are untouched by the laptop's gallery QR.
    await expect(tv.getByTestId('share-qr-link')).toBeVisible()

    const html = await (await fetch(url!)).text()
    const file = html.match(/\/e\/[A-Za-z0-9_-]{22}\/f\/(\d{2}-\d{2}-\d{2}(?:-\d+)?\.jpg)/)?.[1]
    expect(file).toBeTruthy()
    expect(html).toContain('1 foto.')
    expect(html).toContain('Baixar foto das')
    const photo = await fetch(`${url}/f/${file}`)
    expect(photo.headers.get('content-type')).toBe('image/jpeg')
    expect((await photo.arrayBuffer()).byteLength).toBeGreaterThan(10_000)
    expect((await fetch(`${url}/t/${file}`)).status).toBe(200)
    expect((await fetch(`${url}/f/..%2F${file}`)).status).toBe(404)
    // The same link for the whole event.
    await tv.getByRole('button', { name: 'Nova rodada' }).click()
    await expect(footer.getByTestId('event-gallery-qr-link')).toHaveAttribute('data-qr-text', url!)

    await operatorWindow.getByRole('button', { name: 'Encerrar evento' }).click()
    await expect(operatorWindow.getByRole('heading', { name: 'Novo evento' })).toBeVisible()
    await expect(operatorWindow.getByTestId('event-gallery-qr')).toHaveCount(0)
    expect((await fetch(url!)).status).toBe(404)
  })
})
