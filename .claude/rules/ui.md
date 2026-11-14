---
paths:
  - "src/renderer/**/*.tsx"
  - "src/renderer/**/*.css"
---

# UI

- Two surfaces: the operator laptop window and a vertical TV at 1080×1920. Do not make a phone layout.
- Reuse shared components before writing new ones. On the laptop, use shadcn from `src/renderer/shared/components/ui/` first. The TV is the camera surface in `features/camera`, not a restyled shadcn dialog.
- Clickable elements (buttons, checkboxes, selects, labels) get `cursor-pointer`. Touch targets on the TV are at least 64px.
- Every screen needs loading, empty and error states. Light mode only.
- User-facing text is pt-BR (see CLAUDE.md).
