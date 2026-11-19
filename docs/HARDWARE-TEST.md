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

## 5. Photo on the phone over local Wi-Fi (no internet)

Guests scan two QR codes on the TV print screen: first they join the party Wi-Fi, then they open the photo link the notebook serves itself (DESIGN §17). Nothing goes to the internet. Settings are in the `Foto no celular` card on the laptop home screen and saved as `share` in `config.json` (`src/shared/share/settings.ts`).

### Option A: Windows Mobile Hotspot

1. Settings → Network & Internet → Mobile hotspot. Set **Network name** and **Network password** (Edit), band 2.4 GHz for older phones, and turn it **On**. The notebook gets `192.168.137.1` on that network.
2. In the app, `Foto no celular`: tick `Mostrar QR code para baixar a foto`, type the same SSID and password, security `WPA/WPA2`, leave `Endereço do notebook` empty (it detects `192.168.137.1`) and the port at `8787`. Click `Salvar`. The status line must say `Ativo em http://192.168.137.1:8787`.
3. **Firewall prompt.** The first time the server starts, Windows Defender Firewall asks whether `Foto Mágica` may communicate on networks. Tick **Private networks** and click Allow. If it was dismissed or denied, phones will time out. Fix it in Windows Security → Firewall & network protection → Allow an app through firewall → `Foto Mágica` → tick Private, or in an admin PowerShell:
   `New-NetFirewallRule -DisplayName "Foto Magica photo" -Direction Inbound -Protocol TCP -LocalPort 8787 -Action Allow -Profile Private,Public`
   The hotspot network can be classed as Public. Use the rule above, or set the adapter to Private.

**Hotspot will not turn on without internet.** Windows Mobile Hotspot usually wants a connection to share and greys out or fails with none. Workarounds:

- **Loopback adapter:** in Device Manager → Action → Add legacy hardware → Network adapters → Microsoft → **Microsoft KM-TEST Loopback Adapter**. Then pick it under "Share my internet connection from". Windows treats it as a connection and the hotspot starts. This varies with the Windows build.
- **Hosted network**, if the Wi-Fi card supports it: run `netsh wlan show drivers` and look for `Hosted network supported : Yes`. Then, in an admin prompt:
  `netsh wlan set hostednetwork mode=allow ssid=FotoMagica key=<password>` and `netsh wlan start hostednetwork`.
  Most modern Wi-Fi drivers say `No`. The address is then usually `192.168.137.1` only after enabling Internet Connection Sharing on it, so check it with `ipconfig` and type it in `Endereço do notebook` if needed.

### Option B (reliable fallback): a standalone Wi-Fi router

A cheap travel router works with no internet uplink. Its DHCP is enough.

1. Power the router, set its SSID and WPA2 password, and leave the WAN port empty.
2. Connect the notebook to it by Wi-Fi or Ethernet. Ignore "No internet".
3. Find the notebook's address: `ipconfig` in a prompt, under the adapter connected to the router, `IPv4 Address` (for example `192.168.0.105`). The app picks the first private address by itself. Type it in `Endereço do notebook` anyway if the notebook has several adapters (a VPN, a virtual switch, Ethernet and Wi-Fi). In the router's admin page, reserve that address for the notebook (DHCP reservation) so it does not change between events.
4. Mark the network Private and allow the firewall prompt as in Option A.

### Checks

| # | Check | Expected |
| --- | --- | --- |
| P1 | Save the settings with the hotspot or router on | `Ativo em http://<address>:8787` |
| P2 | Print a round | The TV shows `1. Conecte-se ao Wi-Fi` and `2. Escaneie para baixar` with two QR codes |
| P3 | Scan the first QR with an iPhone and an Android phone | The phone joins the Wi-Fi without typing the password |
| P4 | Scan the second QR | A page `Sua Foto Mágica` with the montage. `Baixar foto` saves it (on iPhone, press and hold → Save to Photos) |
| P5 | `Nova rodada` | The QR codes leave the TV. The old link still opens on the phone |
| P6 | `Encerrar evento`, then reload the page on the phone | `Não encontrado` |
| P7 | Turn the hotspot off and save again | `Sem rede local. Ligue o hotspot ou conecte ao roteador`, and no QR on the TV |

If phones join but the page never loads, the cause is almost always the firewall (Public profile) or a wrong address. Check `ipconfig` and the status line.
