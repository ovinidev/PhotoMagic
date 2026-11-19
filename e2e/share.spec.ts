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
})
