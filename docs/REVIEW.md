# Final review (branch `chore/final-review`, 2026-11-17)

Fixes found in the final review before the first hardware test. Each one has a test that failed before the fix and passes after it. Run them with:

```bash
pnpm vitest run src/main/print/dnp/bridge.review.test.ts src/main/session/saveMontage.review.test.ts src/main/persist/templates.review.test.ts src/main/persist/log.test.ts --reporter=dot
```

## 1. A status poll could kill a print in progress

- **Commit:** `22f6500` Send one helper request at a time so a status poll cannot kill a print
- **Severity:** high. The PowerShell PrintTicket helper reads one request at a time, but the bridge started each request's timeout when it was queued. A status poll queued behind a 10-copy print timed out and killed the helper mid-print. Requests queued behind a dead helper also waited for their own timeout instead of failing at once.
- **Fix:** `src/main/print/dnp/bridge.ts` sends one request at a time and starts its timeout only when it is written; pending requests fail at once when the helper exits.
- **Proving test:** `src/main/print/dnp/bridge.review.test.ts` (also `bridge.test.ts` updated)
- **Status:** fixed

## 2. Montage lost when the event folder was deleted or moved mid-event

- **Commit:** `d61e814` Recreate a missing event folder before saving the montage
- **Severity:** high. If the operator removed or renamed the Desktop event folder during the event, saving the montage failed and that print was lost.
- **Fix:** `src/main/session/saveMontage.ts` recreates the folder (`mkdir -p`) before writing `HH-mm-ss.jpg`.
- **Proving test:** `src/main/session/saveMontage.review.test.ts`
- **Status:** fixed

## 3. A truncated template was accepted and stored

- **Commit:** `02cd15d` Refuse a template whose pixel data is truncated instead of storing it
- **Severity:** medium. A 1844×1240 file with a valid header but cut-off pixel data passed the size check, was written to `templates/` and only failed later, when composing a montage at the event.
- **Fix:** `src/main/persist/templates.ts` decodes the whole image (the preview) before writing anything and returns `reason: 'unreadable'`.
- **Proving test:** `src/main/persist/templates.review.test.ts`
- **Status:** fixed

## 4. One log helper for persist and updater

- **Commits:** `e746bdf` (wip), `7397ff8` Share one log helper between persist and updater
- **Severity:** low (refactor, no behavior change). The append-only file logger moved from `src/main/updater/log.ts` to `src/main/persist/log.ts` (`createFileLog`), so other main-process modules can write to `<userData>/logs/` the same way. `updater.log` keeps its path and format.
- **Proving test:** `src/main/persist/log.test.ts`
- **Status:** fixed
