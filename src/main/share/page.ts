import { DOWNLOAD_FILE } from '@shared/share'

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)

/** The guest's phone page: the montage and one big download button, pt-BR, no script, no external asset. */
export function sharePage(token: string, fileName: string): string {
  const src = `/p/${token}/${DOWNLOAD_FILE}`
  const name = escapeHtml(`foto-magica-${fileName}`)
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Foto Mágica</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; box-sizing: border-box; background: #111; color: #fff; font-family: system-ui, sans-serif; text-align: center; }
  h1 { margin: 8px 0 0; font-size: 24px; }
  img { width: 100%; max-width: 640px; border-radius: 12px; background: #222; }
  a { display: block; width: 100%; max-width: 640px; box-sizing: border-box; padding: 18px; border-radius: 999px; background: #fff; color: #111; font-size: 20px; font-weight: 700; text-decoration: none; }
  p { margin: 0; color: #bbb; font-size: 15px; }
</style>
</head>
<body>
<h1>Sua Foto Mágica</h1>
<img src="${src}" alt="Sua foto">
<a href="${src}" download="${name}">Baixar foto</a>
<p>Se o botão não funcionar, toque e segure a foto e escolha salvar.</p>
</body>
</html>`
}
