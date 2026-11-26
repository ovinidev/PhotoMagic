# Plan: folder-per-module structure (PilatePay style)

Status: proposal. No code moves in this PR. Written 2026-11-18 against `main` at `457de32`.

Reference: PilatePay `AGENTS.md` ("Code organization"), `.claude/rules/structure.md`, `docs/DESIGN.md` §8, and [PilatePay#42](https://github.com/ovinidev/PilatePay/pull/42) ("move every src module into its own folder": 214 `git mv` moves, an `index.ts` per folder, no behavior change).

PhotoMagic already follows PilatePay's **feature-based** layout (DESIGN §13). What it lacks is PilatePay's second rule, **folder per module**. This refactor adds that rule and nothing else. No renames, no merges, no behavior changes, no new aliases.

## 1. Current tree (brief)

232 files under `src/` (68 test files), 55 folders.

```
src/
  main/        index.ts + areas: compose/ gallery/ ipc/ media/ persist/ print/ (dnp/) session/ updater/ windows/
               files are flat inside each area: print/SimulatedPrinter.ts, print/SimulatedPrinter.test.ts, ...
  preload/     index.ts, fotomagica.d.ts
  shared/      flat files (constants.ts, displays.ts, round.ts, runtime.ts, template.ts, webcam.ts, zoom.ts,
               closeHold.ts) + folders capture/ files/ ipc/ layout/, each with an index.ts barrel
  renderer/    operator.html, guest.html, index.css
               app/operator/{OperatorApp.tsx, main.tsx, components/, hooks/, pages/}, app/guest/{GuestApp.tsx, main.tsx}
               features/{camera,events,gallery,layout,print,session,webcam}/{components,hooks,utils}/Name.tsx + copy.ts + index.ts
               shared/{components/ui/button.tsx, hooks/, utils/}
               test/{setup.ts, bridge.ts}
```

Imports are already almost entirely through barrels or aliases: `@shared/ipc` (58 imports), `@shared/layout` (39), `@renderer/shared/utils/cn` (17), feature `index.ts` (`@renderer/features/print`, ...). Relative imports: 245 `./x`, 96 `../x`. No test uses `vi.mock`.

## 2. Target tree

Every component, hook, util, service, handler or pure-rule file gets its own folder named after it, inside the grouping folder it already lives in. The folder holds `Name.ts(x)`, its tests (`Name.test.ts`, `Name.<case>.test.ts`) and an `index.ts` with `export * from './Name'`. The same rule applies to all three Electron processes and to `src/shared`.

```
src/
  main/
    index.ts                                   (not wrapped: process entry)
    compose/
      detectBoxes/{detectBoxes.ts, detectBoxes.test.ts, index.ts}
      renderSheet/{renderSheet.ts, renderSheet.test.ts, renderSheet.seams.test.ts, index.ts}
    gallery/   index.ts + gallery/{gallery.ts, gallery.test.ts, index.ts}
    ipc/       index.ts + app/ camera/ display/ event/ gallery/ handle/ printer/ update/ webcam/ zoom/
    media/     index.ts + policy/
    persist/   index.ts + config/ log/ templates/{templates.ts, templates.test.ts, templates.review.test.ts, index.ts}
    print/     index.ts + SimulatedPrinter/ WindowsDnpPrinter/ monitor/ types/
      dnp/     dnp-helper.ps1 (stays here, not a TS module) + bridge/ capabilities/ protocol/ spooler/
    session/   index.ts + saveMontage/ session/
    updater/   index.ts + log/ policy/
    windows/   index.ts + appIcon.test.ts (stays: tests assets/brand, no single module)
               displayFixtures/ displaySource/ guestWindow/ guestWindowController/ operatorWindow/
               operatorZoom/ rendererEntry/
    assets.d.ts                                (not wrapped: *.d.ts)
  preload/
    index.ts, fotomagica.d.ts                  (not wrapped: entry + *.d.ts)
  shared/
    capture/   index.ts + camera/ orientation/
    files/     index.ts + eventName/ montageName/
    ipc/       index.ts + api/ channels/ contract/ schemas/
    layout/    index.ts + framing/ geometry/ gesture/ guides/ seed/ snap/ types/
    closeHold/ constants/ displays/ round/ runtime/ template/ webcam/ zoom/   (each {Name.ts, Name.test.ts, index.ts})
  renderer/
    operator.html, guest.html, index.css       (unchanged: Vite inputs and the global stylesheet)
    app/
      operator/ OperatorApp.tsx, OperatorApp.test.tsx, main.tsx   (not wrapped: window root, like PilatePay app/App.tsx)
                components/RenderErrorBoundary/  hooks/{useAppVersion,useUpdateStatus,useZoom}/  pages/HomePage/
      guest/    GuestApp.tsx, main.tsx                            (not wrapped)
    features/<name>/
      index.ts                                 (not wrapped: feature entry)
      copy/{copy.ts, index.ts}                 (wrapped; '../copy' specifiers keep working)
      components/<Name>/  hooks/<useName>/  utils/<name>/
    shared/
      components/ui/button/{button.tsx, index.ts}
      hooks/useMontagePreview/ useObjectUrl/ useSessionState/
      utils/cn/ glass/
    test/setup.ts, test/bridge.ts              (not wrapped: test infrastructure, like PilatePay test/setup.ts)
```

Mapping of processes to modules:

| Process / bundle | Root | Module unit | Entry points (never wrapped) |
|---|---|---|---|
| Electron main (`out/main`) | `src/main/` | area folder (`print/`, `persist/`, ...) holding one folder per file | `src/main/index.ts`, each area `index.ts` |
| Preload (`out/preload`, sandboxed) | `src/preload/` | single module, already minimal | `index.ts`, `fotomagica.d.ts` |
| Renderer (`out/renderer`, two HTML inputs) | `src/renderer/` | `features/<name>/` with `components/ hooks/ utils/`, one folder per file | `operator.html`, `guest.html`, `app/*/main.tsx`, `OperatorApp.tsx`, `GuestApp.tsx`, feature `index.ts` |
| Shared (bundled into all three) | `src/shared/` | topic folder (`layout/`, `ipc/`, ...) or top-level module folder | topic `index.ts` |

## 3. PilatePay conventions

Adopted:

- **Folder per module** with `Name.ts(x)`, its tests and `index.ts` (`export * from './Name'`). Import the folder (`./utils/captureStill`, `../windows`), never `captureStill/captureStill`; only the module's own test imports `./Name`.
- **Exceptions list**, translated: feature `index.ts`, area/topic `index.ts`, `main.tsx`, window roots `OperatorApp.tsx`/`GuestApp.tsx` (PilatePay's `app/App.tsx`), `*.d.ts`, `renderer/test/*` (PilatePay's `test/setup.ts`), HTML/CSS, and the PowerShell helper.
- **Cross-module tests stay put** (PilatePay kept `App.test.tsx`, `legal.test.tsx`, ...): here `src/main/windows/appIcon.test.ts` and `OperatorApp.test.tsx`.
- **shadcn components wrapped** after `shadcn add`: `shared/components/ui/button/`.
- **`git mv` for every move** so `git log --follow` and blame keep history.
- **Barrels excluded from coverage** (`src/**/index.ts`), as PilatePay#42 did.
- Already in place and kept: feature-based layout, feature imports only through `index.ts`, `shared/` never imports a feature or `app/`, only the subfolders a feature needs.

Not adopted, and why:

- **No single `src/features/<name>/` spanning processes** (e.g. `features/print/{main,renderer}`). electron-vite builds three bundles with different targets (`main` is Node, `preload` is sandboxed and bundles zod, `renderer` is DOM-only), and three tsconfigs (`tsconfig.node.json`, `tsconfig.web.json`, `tsconfig.e2e.json`) select files by process folder. Mixing them in one folder would weaken the oxlint boundaries that keep Node out of the renderer and Electron out of `src/shared` (CLAUDE.md conventions), and break `include` globs. The process split stays at the top; folder-per-module applies inside each process.
- **No `@/` alias.** PilatePay has one root (`@/` = `src/`). Here `@shared`, `@renderer` and `@brand` stay because main must never resolve `@renderer`. No alias is added or renamed.
- **No `api/` grouping folder or TanStack Query.** PilatePay's server state is IPC here (DESIGN §13). Main's areas (`print/`, `persist/`) play the role of `api/` and `services/`.
- **Main areas are not regrouped into `components/hooks/utils`.** Those words describe React code; main keeps its domain areas (`print/`, `session/`, ...) and wraps files inside them.
- **IPC handlers do not move next to their area** (`main/print/ipc`). Tempting, but it is a structural change, not a wrap; out of scope. It can be a later ADR-style proposal.
- **No `.claude/rules/` path-scoped files and no `docs/adr/`.** This repo keeps rules in `CLAUDE.md` and `docs/DESIGN.md`; the new rule goes there (CLAUDE.md "Folders", DESIGN §13).
- **ESLint**: oxlint stays (project decision).

## 4. Move map

Every file under `src/` (232). "unchanged" means the file stays where it is. Each new folder also gets a new `index.ts` (`export * from './Name'`; for a `.tsx` component the same line). Type-only modules (`shared/layout/types.ts`, `main/print/types.ts`) use `export * from './types'` too; with `verbatimModuleSyntax` that is valid for type exports.

| Old path | New path |
|---|---|
| `src/main/assets.d.ts` | unchanged |
| `src/main/compose/detectBoxes.test.ts` | `src/main/compose/detectBoxes/detectBoxes.test.ts` |
| `src/main/compose/detectBoxes.ts` | `src/main/compose/detectBoxes/detectBoxes.ts` |
| `src/main/compose/renderSheet.seams.test.ts` | `src/main/compose/renderSheet/renderSheet.seams.test.ts` |
| `src/main/compose/renderSheet.test.ts` | `src/main/compose/renderSheet/renderSheet.test.ts` |
| `src/main/compose/renderSheet.ts` | `src/main/compose/renderSheet/renderSheet.ts` |
| `src/main/gallery/gallery.test.ts` | `src/main/gallery/gallery/gallery.test.ts` |
| `src/main/gallery/gallery.ts` | `src/main/gallery/gallery/gallery.ts` |
| `src/main/gallery/index.ts` | unchanged |
| `src/main/index.ts` | unchanged |
| `src/main/ipc/app.ts` | `src/main/ipc/app/app.ts` |
| `src/main/ipc/camera.ts` | `src/main/ipc/camera/camera.ts` |
| `src/main/ipc/display.ts` | `src/main/ipc/display/display.ts` |
| `src/main/ipc/event.ts` | `src/main/ipc/event/event.ts` |
| `src/main/ipc/gallery.ts` | `src/main/ipc/gallery/gallery.ts` |
| `src/main/ipc/handle.ts` | `src/main/ipc/handle/handle.ts` |
| `src/main/ipc/index.ts` | unchanged |
| `src/main/ipc/printer.ts` | `src/main/ipc/printer/printer.ts` |
| `src/main/ipc/update.ts` | `src/main/ipc/update/update.ts` |
| `src/main/ipc/webcam.ts` | `src/main/ipc/webcam/webcam.ts` |
| `src/main/ipc/zoom.ts` | `src/main/ipc/zoom/zoom.ts` |
| `src/main/media/index.ts` | unchanged |
| `src/main/media/policy.test.ts` | `src/main/media/policy/policy.test.ts` |
| `src/main/media/policy.ts` | `src/main/media/policy/policy.ts` |
| `src/main/persist/config.test.ts` | `src/main/persist/config/config.test.ts` |
| `src/main/persist/config.ts` | `src/main/persist/config/config.ts` |
| `src/main/persist/index.ts` | unchanged |
| `src/main/persist/log.test.ts` | `src/main/persist/log/log.test.ts` |
| `src/main/persist/log.ts` | `src/main/persist/log/log.ts` |
| `src/main/persist/templates.review.test.ts` | `src/main/persist/templates/templates.review.test.ts` |
| `src/main/persist/templates.test.ts` | `src/main/persist/templates/templates.test.ts` |
| `src/main/persist/templates.ts` | `src/main/persist/templates/templates.ts` |
| `src/main/print/SimulatedPrinter.test.ts` | `src/main/print/SimulatedPrinter/SimulatedPrinter.test.ts` |
| `src/main/print/SimulatedPrinter.ts` | `src/main/print/SimulatedPrinter/SimulatedPrinter.ts` |
| `src/main/print/WindowsDnpPrinter.test.ts` | `src/main/print/WindowsDnpPrinter/WindowsDnpPrinter.test.ts` |
| `src/main/print/WindowsDnpPrinter.ts` | `src/main/print/WindowsDnpPrinter/WindowsDnpPrinter.ts` |
| `src/main/print/dnp/bridge.review.test.ts` | `src/main/print/dnp/bridge/bridge.review.test.ts` |
| `src/main/print/dnp/bridge.test.ts` | `src/main/print/dnp/bridge/bridge.test.ts` |
| `src/main/print/dnp/bridge.ts` | `src/main/print/dnp/bridge/bridge.ts` |
| `src/main/print/dnp/capabilities.test.ts` | `src/main/print/dnp/capabilities/capabilities.test.ts` |
| `src/main/print/dnp/capabilities.ts` | `src/main/print/dnp/capabilities/capabilities.ts` |
| `src/main/print/dnp/dnp-helper.ps1` | unchanged |
| `src/main/print/dnp/protocol.test.ts` | `src/main/print/dnp/protocol/protocol.test.ts` |
| `src/main/print/dnp/protocol.ts` | `src/main/print/dnp/protocol/protocol.ts` |
| `src/main/print/dnp/spooler.test.ts` | `src/main/print/dnp/spooler/spooler.test.ts` |
| `src/main/print/dnp/spooler.ts` | `src/main/print/dnp/spooler/spooler.ts` |
| `src/main/print/index.ts` | unchanged |
| `src/main/print/monitor.test.ts` | `src/main/print/monitor/monitor.test.ts` |
| `src/main/print/monitor.ts` | `src/main/print/monitor/monitor.ts` |
| `src/main/print/types.test.ts` | `src/main/print/types/types.test.ts` |
| `src/main/print/types.ts` | `src/main/print/types/types.ts` |
| `src/main/session/index.ts` | unchanged |
| `src/main/session/saveMontage.review.test.ts` | `src/main/session/saveMontage/saveMontage.review.test.ts` |
| `src/main/session/saveMontage.test.ts` | `src/main/session/saveMontage/saveMontage.test.ts` |
| `src/main/session/saveMontage.ts` | `src/main/session/saveMontage/saveMontage.ts` |
| `src/main/session/session.test.ts` | `src/main/session/session/session.test.ts` |
| `src/main/session/session.ts` | `src/main/session/session/session.ts` |
| `src/main/updater/index.ts` | unchanged |
| `src/main/updater/log.ts` | `src/main/updater/log/log.ts` |
| `src/main/updater/policy.test.ts` | `src/main/updater/policy/policy.test.ts` |
| `src/main/updater/policy.ts` | `src/main/updater/policy/policy.ts` |
| `src/main/windows/appIcon.test.ts` | unchanged |
| `src/main/windows/displayFixtures.ts` | `src/main/windows/displayFixtures/displayFixtures.ts` |
| `src/main/windows/displaySource.ts` | `src/main/windows/displaySource/displaySource.ts` |
| `src/main/windows/guestWindow.ts` | `src/main/windows/guestWindow/guestWindow.ts` |
| `src/main/windows/guestWindowController.test.ts` | `src/main/windows/guestWindowController/guestWindowController.test.ts` |
| `src/main/windows/guestWindowController.ts` | `src/main/windows/guestWindowController/guestWindowController.ts` |
| `src/main/windows/index.ts` | unchanged |
| `src/main/windows/operatorWindow.ts` | `src/main/windows/operatorWindow/operatorWindow.ts` |
| `src/main/windows/operatorZoom.ts` | `src/main/windows/operatorZoom/operatorZoom.ts` |
| `src/main/windows/rendererEntry.test.ts` | `src/main/windows/rendererEntry/rendererEntry.test.ts` |
| `src/main/windows/rendererEntry.ts` | `src/main/windows/rendererEntry/rendererEntry.ts` |
| `src/preload/fotomagica.d.ts` | unchanged |
| `src/preload/index.ts` | unchanged |
| `src/renderer/app/guest/GuestApp.tsx` | unchanged |
| `src/renderer/app/guest/main.tsx` | unchanged |
| `src/renderer/app/operator/OperatorApp.test.tsx` | unchanged |
| `src/renderer/app/operator/OperatorApp.tsx` | unchanged |
| `src/renderer/app/operator/components/RenderErrorBoundary.test.tsx` | `src/renderer/app/operator/components/RenderErrorBoundary/RenderErrorBoundary.test.tsx` |
| `src/renderer/app/operator/components/RenderErrorBoundary.tsx` | `src/renderer/app/operator/components/RenderErrorBoundary/RenderErrorBoundary.tsx` |
| `src/renderer/app/operator/hooks/useAppVersion.ts` | `src/renderer/app/operator/hooks/useAppVersion/useAppVersion.ts` |
| `src/renderer/app/operator/hooks/useUpdateStatus.ts` | `src/renderer/app/operator/hooks/useUpdateStatus/useUpdateStatus.ts` |
| `src/renderer/app/operator/hooks/useZoom.test.ts` | `src/renderer/app/operator/hooks/useZoom/useZoom.test.ts` |
| `src/renderer/app/operator/hooks/useZoom.ts` | `src/renderer/app/operator/hooks/useZoom/useZoom.ts` |
| `src/renderer/app/operator/main.tsx` | unchanged |
| `src/renderer/app/operator/pages/HomePage.tsx` | `src/renderer/app/operator/pages/HomePage/HomePage.tsx` |
| `src/renderer/features/camera/components/CameraPreview.tsx` | `src/renderer/features/camera/components/CameraPreview/CameraPreview.tsx` |
| `src/renderer/features/camera/components/CameraStatusLine.tsx` | `src/renderer/features/camera/components/CameraStatusLine/CameraStatusLine.tsx` |
| `src/renderer/features/camera/components/CameraView.test.tsx` | `src/renderer/features/camera/components/CameraView/CameraView.test.tsx` |
| `src/renderer/features/camera/components/CameraView.tsx` | `src/renderer/features/camera/components/CameraView/CameraView.tsx` |
| `src/renderer/features/camera/components/CaptureControls.test.tsx` | `src/renderer/features/camera/components/CaptureControls/CaptureControls.test.tsx` |
| `src/renderer/features/camera/components/CaptureControls.tsx` | `src/renderer/features/camera/components/CaptureControls/CaptureControls.tsx` |
| `src/renderer/features/camera/components/CloseHoldLayer.test.tsx` | `src/renderer/features/camera/components/CloseHoldLayer/CloseHoldLayer.test.tsx` |
| `src/renderer/features/camera/components/CloseHoldLayer.tsx` | `src/renderer/features/camera/components/CloseHoldLayer/CloseHoldLayer.tsx` |
| `src/renderer/features/camera/components/TvStatus.test.tsx` | `src/renderer/features/camera/components/TvStatus/TvStatus.test.tsx` |
| `src/renderer/features/camera/components/TvStatus.tsx` | `src/renderer/features/camera/components/TvStatus/TvStatus.tsx` |
| `src/renderer/features/camera/components/TvTopBar.tsx` | `src/renderer/features/camera/components/TvTopBar/TvTopBar.tsx` |
| `src/renderer/features/camera/copy.ts` | `src/renderer/features/camera/copy/copy.ts` |
| `src/renderer/features/camera/hooks/useCamera.ts` | `src/renderer/features/camera/hooks/useCamera/useCamera.ts` |
| `src/renderer/features/camera/hooks/useCameraStatus.ts` | `src/renderer/features/camera/hooks/useCameraStatus/useCameraStatus.ts` |
| `src/renderer/features/camera/hooks/useCloseHold.ts` | `src/renderer/features/camera/hooks/useCloseHold/useCloseHold.ts` |
| `src/renderer/features/camera/hooks/useDisplayState.ts` | `src/renderer/features/camera/hooks/useDisplayState/useDisplayState.ts` |
| `src/renderer/features/camera/hooks/useShutter.test.tsx` | `src/renderer/features/camera/hooks/useShutter/useShutter.test.tsx` |
| `src/renderer/features/camera/hooks/useShutter.ts` | `src/renderer/features/camera/hooks/useShutter/useShutter.ts` |
| `src/renderer/features/camera/index.ts` | unchanged |
| `src/renderer/features/camera/utils/cameraErrors.test.ts` | `src/renderer/features/camera/utils/cameraErrors/cameraErrors.test.ts` |
| `src/renderer/features/camera/utils/cameraErrors.ts` | `src/renderer/features/camera/utils/cameraErrors/cameraErrors.ts` |
| `src/renderer/features/camera/utils/captureStill.test.ts` | `src/renderer/features/camera/utils/captureStill/captureStill.test.ts` |
| `src/renderer/features/camera/utils/captureStill.ts` | `src/renderer/features/camera/utils/captureStill/captureStill.ts` |
| `src/renderer/features/camera/utils/drawFrame.ts` | `src/renderer/features/camera/utils/drawFrame/drawFrame.ts` |
| `src/renderer/features/camera/utils/openCamera.test.ts` | `src/renderer/features/camera/utils/openCamera/openCamera.test.ts` |
| `src/renderer/features/camera/utils/openCamera.ts` | `src/renderer/features/camera/utils/openCamera/openCamera.ts` |
| `src/renderer/features/camera/utils/waitForFrame.test.ts` | `src/renderer/features/camera/utils/waitForFrame/waitForFrame.test.ts` |
| `src/renderer/features/camera/utils/waitForFrame.ts` | `src/renderer/features/camera/utils/waitForFrame/waitForFrame.ts` |
| `src/renderer/features/events/components/CreateEventForm.test.tsx` | `src/renderer/features/events/components/CreateEventForm/CreateEventForm.test.tsx` |
| `src/renderer/features/events/components/CreateEventForm.tsx` | `src/renderer/features/events/components/CreateEventForm/CreateEventForm.tsx` |
| `src/renderer/features/events/components/TemplatePicker.tsx` | `src/renderer/features/events/components/TemplatePicker/TemplatePicker.tsx` |
| `src/renderer/features/events/copy.ts` | `src/renderer/features/events/copy/copy.ts` |
| `src/renderer/features/events/hooks/useTemplates.ts` | `src/renderer/features/events/hooks/useTemplates/useTemplates.ts` |
| `src/renderer/features/events/index.ts` | unchanged |
| `src/renderer/features/gallery/components/GalleryImage.tsx` | `src/renderer/features/gallery/components/GalleryImage/GalleryImage.tsx` |
| `src/renderer/features/gallery/components/GalleryPanel.test.tsx` | `src/renderer/features/gallery/components/GalleryPanel/GalleryPanel.test.tsx` |
| `src/renderer/features/gallery/components/GalleryPanel.tsx` | `src/renderer/features/gallery/components/GalleryPanel/GalleryPanel.tsx` |
| `src/renderer/features/gallery/components/GalleryViewer.tsx` | `src/renderer/features/gallery/components/GalleryViewer/GalleryViewer.tsx` |
| `src/renderer/features/gallery/components/TvGallery.tsx` | `src/renderer/features/gallery/components/TvGallery/TvGallery.tsx` |
| `src/renderer/features/gallery/copy.ts` | `src/renderer/features/gallery/copy/copy.ts` |
| `src/renderer/features/gallery/hooks/useGallery.ts` | `src/renderer/features/gallery/hooks/useGallery/useGallery.ts` |
| `src/renderer/features/gallery/hooks/useGalleryImage.ts` | `src/renderer/features/gallery/hooks/useGalleryImage/useGalleryImage.ts` |
| `src/renderer/features/gallery/index.ts` | unchanged |
| `src/renderer/features/layout/components/LayoutEditor.test.tsx` | `src/renderer/features/layout/components/LayoutEditor/LayoutEditor.test.tsx` |
| `src/renderer/features/layout/components/LayoutEditor.tsx` | `src/renderer/features/layout/components/LayoutEditor/LayoutEditor.tsx` |
| `src/renderer/features/layout/components/SheetCanvas.tsx` | `src/renderer/features/layout/components/SheetCanvas/SheetCanvas.tsx` |
| `src/renderer/features/layout/components/SheetGuides.tsx` | `src/renderer/features/layout/components/SheetGuides/SheetGuides.tsx` |
| `src/renderer/features/layout/components/SlotTable.tsx` | `src/renderer/features/layout/components/SlotTable/SlotTable.tsx` |
| `src/renderer/features/layout/components/ZoomableSheet.tsx` | `src/renderer/features/layout/components/ZoomableSheet/ZoomableSheet.tsx` |
| `src/renderer/features/layout/copy.ts` | `src/renderer/features/layout/copy/copy.ts` |
| `src/renderer/features/layout/hooks/useLayouts.ts` | `src/renderer/features/layout/hooks/useLayouts/useLayouts.ts` |
| `src/renderer/features/layout/hooks/useTemplatePreview.ts` | `src/renderer/features/layout/hooks/useTemplatePreview/useTemplatePreview.ts` |
| `src/renderer/features/layout/index.ts` | unchanged |
| `src/renderer/features/layout/utils/canvasZoom.test.ts` | `src/renderer/features/layout/utils/canvasZoom/canvasZoom.test.ts` |
| `src/renderer/features/layout/utils/canvasZoom.ts` | `src/renderer/features/layout/utils/canvasZoom/canvasZoom.ts` |
| `src/renderer/features/layout/utils/history.test.ts` | `src/renderer/features/layout/utils/history/history.test.ts` |
| `src/renderer/features/layout/utils/history.ts` | `src/renderer/features/layout/utils/history/history.ts` |
| `src/renderer/features/layout/utils/livePaint.ts` | `src/renderer/features/layout/utils/livePaint/livePaint.ts` |
| `src/renderer/features/layout/utils/slotColors.ts` | `src/renderer/features/layout/utils/slotColors/slotColors.ts` |
| `src/renderer/features/print/components/PrintScreen.test.tsx` | `src/renderer/features/print/components/PrintScreen/PrintScreen.test.tsx` |
| `src/renderer/features/print/components/PrintScreen.tsx` | `src/renderer/features/print/components/PrintScreen/PrintScreen.tsx` |
| `src/renderer/features/print/components/PrinterStatusLine.test.tsx` | `src/renderer/features/print/components/PrinterStatusLine/PrinterStatusLine.test.tsx` |
| `src/renderer/features/print/components/PrinterStatusLine.tsx` | `src/renderer/features/print/components/PrinterStatusLine/PrinterStatusLine.tsx` |
| `src/renderer/features/print/copy.ts` | `src/renderer/features/print/copy/copy.ts` |
| `src/renderer/features/print/hooks/usePrinterStatus.ts` | `src/renderer/features/print/hooks/usePrinterStatus/usePrinterStatus.ts` |
| `src/renderer/features/print/index.ts` | unchanged |
| `src/renderer/features/session/components/EndEventButton.tsx` | `src/renderer/features/session/components/EndEventButton/EndEventButton.tsx` |
| `src/renderer/features/session/components/FramingEditor.test.tsx` | `src/renderer/features/session/components/FramingEditor/FramingEditor.test.tsx` |
| `src/renderer/features/session/components/FramingEditor.tsx` | `src/renderer/features/session/components/FramingEditor/FramingEditor.tsx` |
| `src/renderer/features/session/components/MontagePreview.tsx` | `src/renderer/features/session/components/MontagePreview/MontagePreview.tsx` |
| `src/renderer/features/session/components/RoundControls.test.tsx` | `src/renderer/features/session/components/RoundControls/RoundControls.test.tsx` |
| `src/renderer/features/session/components/RoundControls.tsx` | `src/renderer/features/session/components/RoundControls/RoundControls.tsx` |
| `src/renderer/features/session/components/RoundScreen.tsx` | `src/renderer/features/session/components/RoundScreen/RoundScreen.tsx` |
| `src/renderer/features/session/copy.ts` | `src/renderer/features/session/copy/copy.ts` |
| `src/renderer/features/session/hooks/useFramingSender.test.ts` | `src/renderer/features/session/hooks/useFramingSender/useFramingSender.test.ts` |
| `src/renderer/features/session/hooks/useFramingSender.ts` | `src/renderer/features/session/hooks/useFramingSender/useFramingSender.ts` |
| `src/renderer/features/session/hooks/useRoundPhotos.ts` | `src/renderer/features/session/hooks/useRoundPhotos/useRoundPhotos.ts` |
| `src/renderer/features/session/index.ts` | unchanged |
| `src/renderer/features/webcam/components/WebcamPanel.test.tsx` | `src/renderer/features/webcam/components/WebcamPanel/WebcamPanel.test.tsx` |
| `src/renderer/features/webcam/components/WebcamPanel.tsx` | `src/renderer/features/webcam/components/WebcamPanel/WebcamPanel.tsx` |
| `src/renderer/features/webcam/components/WebcamSection.tsx` | `src/renderer/features/webcam/components/WebcamSection/WebcamSection.tsx` |
| `src/renderer/features/webcam/copy.ts` | `src/renderer/features/webcam/copy/copy.ts` |
| `src/renderer/features/webcam/hooks/useApplyWebcam.ts` | `src/renderer/features/webcam/hooks/useApplyWebcam/useApplyWebcam.ts` |
| `src/renderer/features/webcam/hooks/useWebcamState.ts` | `src/renderer/features/webcam/hooks/useWebcamState/useWebcamState.ts` |
| `src/renderer/features/webcam/index.ts` | unchanged |
| `src/renderer/guest.html` | unchanged |
| `src/renderer/index.css` | unchanged |
| `src/renderer/operator.html` | unchanged |
| `src/renderer/shared/components/ui/button.tsx` | `src/renderer/shared/components/ui/button/button.tsx` |
| `src/renderer/shared/hooks/useMontagePreview.ts` | `src/renderer/shared/hooks/useMontagePreview/useMontagePreview.ts` |
| `src/renderer/shared/hooks/useObjectUrl.test.tsx` | `src/renderer/shared/hooks/useObjectUrl/useObjectUrl.test.tsx` |
| `src/renderer/shared/hooks/useObjectUrl.ts` | `src/renderer/shared/hooks/useObjectUrl/useObjectUrl.ts` |
| `src/renderer/shared/hooks/useSessionState.ts` | `src/renderer/shared/hooks/useSessionState/useSessionState.ts` |
| `src/renderer/shared/utils/cn.ts` | `src/renderer/shared/utils/cn/cn.ts` |
| `src/renderer/shared/utils/glass.ts` | `src/renderer/shared/utils/glass/glass.ts` |
| `src/renderer/test/bridge.ts` | unchanged |
| `src/renderer/test/setup.ts` | unchanged |
| `src/shared/capture/camera.test.ts` | `src/shared/capture/camera/camera.test.ts` |
| `src/shared/capture/camera.ts` | `src/shared/capture/camera/camera.ts` |
| `src/shared/capture/index.ts` | unchanged |
| `src/shared/capture/orientation.test.ts` | `src/shared/capture/orientation/orientation.test.ts` |
| `src/shared/capture/orientation.ts` | `src/shared/capture/orientation/orientation.ts` |
| `src/shared/closeHold.test.ts` | `src/shared/closeHold/closeHold.test.ts` |
| `src/shared/closeHold.ts` | `src/shared/closeHold/closeHold.ts` |
| `src/shared/constants.test.ts` | `src/shared/constants/constants.test.ts` |
| `src/shared/constants.ts` | `src/shared/constants/constants.ts` |
| `src/shared/displays.test.ts` | `src/shared/displays/displays.test.ts` |
| `src/shared/displays.ts` | `src/shared/displays/displays.ts` |
| `src/shared/files/eventName.test.ts` | `src/shared/files/eventName/eventName.test.ts` |
| `src/shared/files/eventName.ts` | `src/shared/files/eventName/eventName.ts` |
| `src/shared/files/index.ts` | unchanged |
| `src/shared/files/montageName.test.ts` | `src/shared/files/montageName/montageName.test.ts` |
| `src/shared/files/montageName.ts` | `src/shared/files/montageName/montageName.ts` |
| `src/shared/ipc/api.ts` | `src/shared/ipc/api/api.ts` |
| `src/shared/ipc/channels.ts` | `src/shared/ipc/channels/channels.ts` |
| `src/shared/ipc/contract.ts` | `src/shared/ipc/contract/contract.ts` |
| `src/shared/ipc/index.ts` | unchanged |
| `src/shared/ipc/schemas.test.ts` | `src/shared/ipc/schemas/schemas.test.ts` |
| `src/shared/ipc/schemas.ts` | `src/shared/ipc/schemas/schemas.ts` |
| `src/shared/layout/framing.test.ts` | `src/shared/layout/framing/framing.test.ts` |
| `src/shared/layout/framing.ts` | `src/shared/layout/framing/framing.ts` |
| `src/shared/layout/geometry.test.ts` | `src/shared/layout/geometry/geometry.test.ts` |
| `src/shared/layout/geometry.ts` | `src/shared/layout/geometry/geometry.ts` |
| `src/shared/layout/gesture.test.ts` | `src/shared/layout/gesture/gesture.test.ts` |
| `src/shared/layout/gesture.ts` | `src/shared/layout/gesture/gesture.ts` |
| `src/shared/layout/guides.test.ts` | `src/shared/layout/guides/guides.test.ts` |
| `src/shared/layout/guides.ts` | `src/shared/layout/guides/guides.ts` |
| `src/shared/layout/index.ts` | unchanged |
| `src/shared/layout/seed.test.ts` | `src/shared/layout/seed/seed.test.ts` |
| `src/shared/layout/seed.ts` | `src/shared/layout/seed/seed.ts` |
| `src/shared/layout/snap.test.ts` | `src/shared/layout/snap/snap.test.ts` |
| `src/shared/layout/snap.ts` | `src/shared/layout/snap/snap.ts` |
| `src/shared/layout/types.ts` | `src/shared/layout/types/types.ts` |
| `src/shared/round.test.ts` | `src/shared/round/round.test.ts` |
| `src/shared/round.ts` | `src/shared/round/round.ts` |
| `src/shared/runtime.test.ts` | `src/shared/runtime/runtime.test.ts` |
| `src/shared/runtime.ts` | `src/shared/runtime/runtime.ts` |
| `src/shared/template.test.ts` | `src/shared/template/template.test.ts` |
| `src/shared/template.ts` | `src/shared/template/template.ts` |
| `src/shared/webcam.test.ts` | `src/shared/webcam/webcam.test.ts` |
| `src/shared/webcam.ts` | `src/shared/webcam/webcam.ts` |
| `src/shared/zoom.test.ts` | `src/shared/zoom/zoom.test.ts` |
| `src/shared/zoom.ts` | `src/shared/zoom/zoom.ts` |

Totals: 197 moves, 35 unchanged, 131 new folders, each with a new `index.ts`.

## 5. Import and alias changes

Because every new folder has an `index.ts`, **specifiers that point at a moved module do not change**: `@shared/round`, `@shared/layout`, `../copy`, `./types`, `../windows`, `@renderer/shared/utils/cn` and `@renderer/shared/components/ui/button` all resolve to the folder's `index.ts`.

What does change:

- **Relative imports written inside a moved file** go one level deeper. `shared/layout/snap.ts` importing `./geometry` becomes `../geometry` in `shared/layout/snap/snap.ts`; `features/print/components/PrintScreen.tsx` importing `../copy` becomes `../../copy`. A moved test keeps `./Name` for its own module and gains one `../` for everything else. This is the bulk of the edit (about 340 relative imports, many in tests). Do it with `git mv` plus a throwaway codemod kept outside the repo, then let `pnpm typecheck` catch misses.
- **`?raw` import of the print helper**: `WindowsDnpPrinter.ts` has `import helperScript from './dnp/dnp-helper.ps1?raw'`; after the move it becomes `'../dnp/dnp-helper.ps1?raw'`. The `.ps1` stays in `print/dnp/`.
- **Filesystem paths built from `import.meta.dirname` in tests** gain one `../`:
  - `main/compose/detectBoxes.test.ts`: `'../../../docs/assets/briefing/template-2-tiras.png'` → `'../../../../...'`. It ends in `.catch(() => null)`, so a wrong path **silently skips** the assertion instead of failing. Check it by hand.
  - `main/compose/renderSheet.test.ts`: `'../../../e2e/fixtures/client-2tiras-1844x1240.png'` → four levels.
  - `main/windows/appIcon.test.ts` does not move, so its path stays.
- **`main/windows/rendererEntry.ts`** uses `join(__dirname, '../preload/index.js')` and `../renderer/${page}.html`. `__dirname` is the bundled `out/main/`, not the source folder, so these **must not** change.

Config files:

| File | Change |
|---|---|
| `tsconfig.base.json` `paths` | none (`@shared/*`, `@renderer/*`, `@brand/*` still point at the same roots) |
| `tsconfig.node.json`, `tsconfig.web.json` `include` | none (`src/main/**/*`, `src/renderer/**/*`, ... still match) |
| `tsconfig.e2e.json` `include` | none (`src/preload/fotomagica.d.ts` is not wrapped) |
| `electron.vite.config.mts` | none: aliases unchanged, renderer `root` and the `operator.html`/`guest.html` inputs unchanged, `main.tsx` paths in the HTML unchanged |
| `vitest.config.mts` | `include` globs unchanged; `setupFiles: ['src/renderer/test/setup.ts']` unchanged; add `'src/**/index.ts'` to `coverage.exclude` (no thresholds exist today) |
| `playwright.config.ts`, `e2e/*` | none: the only `src` import is `@shared/layout` in `print.spec.ts`; `fixtures.ts` mentions `src/renderer/guest.html` in a comment, which stays valid |
| `.oxlintrc.json` | none needed: `**/features/*/*` still blocks deep feature imports, the `src/shared/**` and `src/renderer/**` overrides still match. Optional, last PR: nothing (oxlint cannot express "no `Name/Name`"); PilatePay relies on review for that too |
| `electron-builder.yml` | none (packages `out/**` only) |
| Docs | CLAUDE.md "Folders" gets the folder-per-module rule; DESIGN §13 tree and every `src/...` path in `DESIGN.md`, `HARDWARE-TEST.md` and `REVIEW.md` (about 40 mentions, e.g. `src/main/print/dnp/bridge.ts` → `src/main/print/dnp/bridge/bridge.ts`). Folder paths like `src/shared/layout/` stay valid |

## 6. Step order (small PRs)

Each PR is `git mv` + `index.ts` + relative-import fixes, one area at a time, no behavior change, and updates the docs paths for the files it moves (CLAUDE.md: change a rule, update the doc in the same PR). Each PR is a release on merge (§7), so each must be green on its own. Commands follow CLAUDE.md: focused tests while iterating, the pre-push hook runs the full contract.

| # | Branch / PR | Scope | Verification |
|---|---|---|---|
| 1 | `refactor/modules-shared` | Add the rule to CLAUDE.md "Folders" and DESIGN §13 (marked "migration in progress"). Wrap `src/shared/**` (pure, node tests only). Add `src/**/index.ts` to coverage exclude | `pnpm lint`, `pnpm typecheck`, `pnpm vitest run src/shared --reporter=dot` |
| 2 | `refactor/modules-main` | Wrap `src/main/` areas except `print/`: `compose`, `gallery`, `ipc`, `media`, `persist`, `session`, `updater`, `windows`. Fix the two `import.meta.dirname` test paths | `pnpm lint`, `pnpm typecheck`, `pnpm vitest run src/main --reporter=dot` (confirm `detectBoxes` ran, not skipped), `pnpm build` |
| 3 | `refactor/modules-print` | Wrap `src/main/print/` and `print/dnp/`; fix the `?raw` helper import | `pnpm lint`, `pnpm typecheck`, `pnpm vitest run src/main/print --reporter=dot`, `pnpm build`, then `grep -c "PrintTicket" out/main/index.js` (or another string unique to `dnp-helper.ps1`) is non-zero; `pnpm exec playwright test e2e/print.spec.ts --reporter=dot` |
| 4 | `refactor/modules-renderer-shared` | Wrap `src/renderer/shared/**` (incl. `ui/button/`) and `src/renderer/app/**` | `pnpm lint`, `pnpm typecheck`, `pnpm vitest run src/renderer/shared src/renderer/app --reporter=dot` |
| 5 | `refactor/modules-tv-features` | Wrap `features/camera`, `features/webcam`, `features/gallery`, `features/events` | `pnpm lint`, `pnpm typecheck`, `pnpm vitest run src/renderer/features/{camera,webcam,gallery,events} --reporter=dot`, `pnpm build` |
| 6 | `refactor/modules-laptop-features` | Wrap `features/layout`, `features/print`, `features/session` | `pnpm lint`, `pnpm typecheck`, `pnpm vitest run src/renderer/features/{layout,print,session} --reporter=dot`, `pnpm build` |
| 7 | `refactor/modules-finish` | DESIGN §13 final tree, drop "migration in progress", sweep stale `src/...` paths in docs (`grep -rnoE "src/[^ )]+\.(ts|tsx)" docs CLAUDE.md` and check each exists). Before merge, run `release.yml` with `workflow_dispatch` on the branch: it builds `FotoMagica-Setup.exe` on `windows-latest` and never publishes from a non-`main` branch | `pnpm lint`, `pnpm typecheck`, `pnpm build`, full E2E once: `pnpm test:e2e --reporter=line` (failures only) |

A check that every moved file has its folder, usable in each PR:

```bash
# every non-exempt source file must sit in a folder named after it
find src -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.*' ! -name 'index.ts' ! -name 'main.tsx' \
  ! -name '*.d.ts' ! -name 'OperatorApp.tsx' ! -name 'GuestApp.tsx' ! -path 'src/renderer/test/*' \
  | awk -F/ '{ f=$NF; sub(/\.tsx?$/, "", f); if (f != $(NF-1)) print }'
```

## 7. Risks

- **Packaging (`electron-builder.yml`).** `files` is `out/**` + `package.json`, `asar: true`, `asarUnpack` only for `sharp`/`@img`. Source layout never reaches the installer; only bundled output does, so the moves do not change packaging. `assets/brand` is not moved: `buildResources: assets/brand`, `win.icon` and `nsis.*Icon: assets/brand/icon.ico`, the `@brand` alias, `operatorWindow.ts`'s `@brand/icon.png?asset` and `scripts/build-icon.mjs` stay valid. `appIcon.test.ts` stays in `windows/` so its `../../../assets/brand/icon.ico` path holds. Verified in PR 7 by a branch `workflow_dispatch` build.
- **Auto-release (`.github/workflows/release.yml`).** Every merge to `main` publishes a patch release (`v<x.y.z>`, installed apps update on next start). Seven PRs = seven releases, each of which must work on a real machine. Mitigations: each PR is behavior-neutral and gated by the same `ci.yml` (typecheck, lint, `test:coverage`, E2E under `xvfb-run` with `FOTOMAGICA_PRINTER=simulated`); merge them on days without an event; never re-upload or tag by hand. The workflow references no `src/` path, so it needs no edit. Note this plan PR itself also triggers a release when merged.
- **Print path (`src/main/print`).** The PowerShell helper is bundled as text via `?raw` and written to disk at runtime (`WindowsDnpPrinter.ts`, `join(helperDir, 'dnp-helper.ps1')`). A wrong `?raw` path fails the build (good), but nothing on Linux CI runs the real helper, and the DS-RX1 path is still unconfirmed on the device (DESIGN §10, `docs/HARDWARE-TEST.md`). That is why print gets its own PR (3) with a bundle grep, and why `HARDWARE-TEST.md` paths are updated there. Only `src/main/print/` may talk to the driver; the move keeps that true.
- **CI simulated mode.** CI and E2E never touch hardware: `FOTOMAGICA_PRINTER=simulated` (`ci.yml`, `e2e/fixtures.ts`) selects `SimulatedPrinter` in `main/print/index.ts`; `FOTOMAGICA_PRINTER_STATUS` / `FOTOMAGICA_PRINTER_CUT` drive failures; the camera is Chromium's fake device via `main/media/policy.ts` (`use-fake-device-for-media-stream`, `use-file-for-fake-video-capture`, driven by `FOTOMAGICA_FAKE_CAMERA`); flags are parsed in `shared/runtime.ts`. All of these keep their barrel specifiers (`../print`, `@shared/runtime`, `../media`), so behavior is unchanged, but a green CI proves only the simulated paths; the real printer and webcam need the hardware checklist after the series.
- **Renderer windows (`operator.html`, `guest.html`).** They are electron-vite inputs at `src/renderer/` and load `./app/operator/main.tsx` and `./app/guest/main.tsx`. Neither the HTML nor `main.tsx` moves, and `rendererEntry.ts` loads `out/renderer/<page>.html`, which is decided by the build, not the source tree. Keep `OperatorApp.tsx`/`GuestApp.tsx` unwrapped to avoid touching the window roots. The CSP in both HTML files is untouched.
- **Silent test skips and merge conflicts.** The `detectBoxes` test skips on a missing file (see §5). A wide move series conflicts with any open PR touching `src/`; land open feature work first or rebase it with `git mv`-aware merges, and keep each PR short-lived.
- **Pending feature.** The camera choice in create-event (CLAUDE.md "Not built yet") should land either before PR 5 or after the series, not in parallel with it.
