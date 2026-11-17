# Hardware test checklist (DS-RX1, MX Brio, vertical touch TV)

For Vinicius, on the Windows 10/11 notebook. CI never runs the PowerShell print helper, the real webcam or a second monitor (DESIGN §12), so this is the first check on the real devices. Every path and setting below comes from the code; the source file is given next to each one.

`%APPDATA%\Foto Mágica` below is the app's `userData` (`app.getPath('userData')`, `productName: Foto Mágica` in `electron-builder.yml`).

## 1. Prerequisites

### Printer (DNP DS-RX1)

- Install the DNP DS-RX1 Windows driver and confirm a test page prints from Windows.
- **Queue name:** the app uses the **first Windows printer whose name contains `DS-RX1`** (any case) and nothing else. There is no printer setting in the app (`src/main/print/dnp/spooler.ts`). Keep the default driver name (for example `DS-RX1`) and do not install two DS-RX1 queues.
- **Paper:** 6×4" (152.4 × 101.6 mm) media and ribbon loaded. The app chooses the driver's `PageMediaSize` within 5 mm of 6×4, by size and not by name, and refuses to print if there is none (`src/main/print/dnp/capabilities.ts`). Do not load 6×8 or 6×2.
- **2" cut:** the driver must show the setting `2inch cut` with `Disable` and `Enable (Printer V.1.10 or later)`. The printer firmware must be V1.10 or later for `Enable`. The app turns it **on in 2-strip mode and off in 1-strip mode** on every print. If the driver names it differently or has two cut settings, the app refuses with `cut-unavailable` instead of guessing.
- The app also asks for **Portrait** (required) and **300×300 DPI** (only if the driver offers it). It does not change border, overcoat, retry or page layout. Leave those at their driver defaults.
- Windows PowerShell 5.1 (`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`) must exist. It ships with Windows 10/11, so nothing needs installing (`src/main/print/dnp/protocol.ts`).
- The Windows queue must not be paused or set to "Use printer offline".

### Camera (Logitech MX Brio)

- Plug it in before starting the app. The app opens the camera whose label contains `MX Brio`, otherwise the first camera (`src/shared/capture/camera.ts`). It asks for 1920×1080 at 30 fps, no audio.
- Mount it **horizontally** on top of the TV. The app rotates the image 90° and mirrors it in software (`CAMERA_ROTATION_DEG = 90`, `src/shared/constants.ts`). Do not rotate it in the Logitech software.
- Close Logi Tune, Zoom, Teams and any other app using the camera.

### TV

- Samsung TV connected as a **second display, in portrait (1080×1920)**, Windows display mode "Extend". The app picks the non-primary portrait monitor closest to 9:16; the monitor index is never hardcoded (`src/shared/displays.ts`). The notebook screen stays primary.
- Touch: in Windows "Tablet PC Settings" → "Setup", map touch input to the TV.

### Template

- Have one 1844×1240 px PNG or JPG background for each mode. Any other size is refused.

## 2. Install

1. Download `https://github.com/ovinidev/PhotoMagic/releases/latest/download/FotoMagica-Setup.exe`.
2. Run it. It installs per user, without admin rights, into `%LOCALAPPDATA%\Programs\fotomagica`, with a desktop and Start menu shortcut `Foto Mágica` (`electron-builder.yml`). If SmartScreen warns (the installer may be unsigned), choose "More info" → "Run anyway".
3. Start `Foto Mágica`. Note the version shown in the laptop header.

## 3. Checks

Write down pass or fail, and what you saw, for each one.

| # | Do | Expected |
| --- | --- | --- |
| 1 | Start the app with the TV connected | Laptop window opens on the notebook. No TV window yet (the TV opens only with an event) |
| 2 | Create an event, `Teste 1`, 2-strip mode, import the 2-strip template, `Iniciar evento` | TV goes full screen on the TV, live image upright and mirrored like a mirror. Laptop camera line `Câmera ao vivo`. Folder `Desktop\Teste 1` exists |
| 3 | Laptop printer line, with the printer on, paper and ribbon in | `Impressora pronta` |
| 4 | Take a round from the TV (3 photos) | Countdown and three photos. The montage preview matches what people saw (no extra rotation, same mirroring) |
| 5 | `Imprimir`, 1 copy | Prints silently, with no Windows dialog. 6×4 sheet, **cut in two 2" strips**, the cut falling between the strips (cut line y = 620, still to confirm on a sheet). `Desktop\Teste 1\HH-mm-ss.jpg` exists |
| 6 | Compare the print with the JPG | Same orientation, no stretching, nothing cropped at the edges, no white border from the app |
| 7 | `Imprimir novamente` with 3 copies (`Mais`) | Three sheets in one job, all cut. The status line does not go to an error while printing (fixed on this branch, see [REVIEW.md](REVIEW.md) §1) |
| 8 | `Encerrar evento`, create `Teste 2` in 1-strip mode with the 1-strip template, one round, `Imprimir` | Full 6×4 sheet with three photos, **no cut**, no blank half |
| 9 | Turn the printer off, wait about 5 s | Line `Impressora desligada`. The TV keeps responding. Turn it on: back to `Impressora pronta` |
| 10 | Open the paper door or remove the paper, then `Imprimir` | Note the message. `Impressora sem papel` if the driver reports it; otherwise `Não foi possível imprimir. O driver não informou papel nem ribbon`. Copy any `Detalhe técnico: …` text |
| 11 | Pause the queue in Windows, then `Imprimir` | `A fila da impressora está pausada no Windows`, nothing stuck in the queue. Resume it |
| 12 | Unplug the MX Brio mid-round, plug it back | The round stays. The TV still responds to touch |
| 13 | Unplug the TV HDMI mid-event, plug it back | Laptop says the TV was disconnected. The TV window comes back on the TV by itself, round kept |
| 14 | Hold two fingers still on the TV for 2 s | Hint `Continue segurando com dois dedos para fechar a tela`, then the TV window hides. Laptop `Tela da TV fechada` → `Abrir TV` brings it back |
| 15 | Delete `Desktop\Teste 2` during the event, then print a round | Printed, and the folder is recreated with the JPG (fixed on this branch, [REVIEW.md](REVIEW.md) §2) |
| 16 | With Wi-Fi on and no event, restart the app | Starts normally. If a newer release exists, the header shows `Baixando atualização …`, then `… pronta: será instalada ao fechar o app` |
| 17 | With Wi-Fi off, restart the app | Starts without waiting. No error on screen |

## 4. What to send back

Zip these and send them with the filled-in table and a phone photo of each printed sheet (checks 5, 7, 8):

| File | Path | What it has |
| --- | --- | --- |
| Print log | `%APPDATA%\Foto Mágica\logs\print.log` | Each print sent (queue, copies, cut on/off, page size from the driver) and all PowerShell helper errors (`src/main/print/index.ts`) |
| Update log | `%APPDATA%\Foto Mágica\logs\updater.log` | Auto-update messages and errors (`src/main/updater/log.ts`) |
| Settings | `%APPDATA%\Foto Mágica\config.json` | Layouts, which templates were imported, webcam values and the controls the camera reported, laptop zoom (`src/main/persist/config.ts`) |
| Templates | `%APPDATA%\Foto Mágica\templates\` | The imported backgrounds (`two-strips.png`/`.jpg`, `one-strip.png`/`.jpg`) |
| Montages | `Desktop\Teste 1\*.jpg`, `Desktop\Teste 2\*.jpg` | The saved sheets, to compare with the prints |

Also send:

- The exact printer name as Windows lists it, and the driver version (Printer properties → Advanced).
- A screenshot of the driver's Printing Preferences → Advanced tab, showing `2inch cut` and the paper size list.
- The output of this command in Windows PowerShell, which lists the queues the app sees:
  `Get-Printer | Select-Object Name, DriverName, PrinterStatus | Format-Table -AutoSize`

`%APPDATA%\Foto Mágica\helpers\dnp-helper.ps1` is the print helper the app writes on each launch. It does not need to be sent.
