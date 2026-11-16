import { SHEET } from '@shared/constants'
import { guideBoxes, type PrintMode } from '@shared/layout'

/**
 * The mode's standard photo boxes as gray rounded rectangles over a sheet-sized parent (PRD §6.2):
 * the operator sees where the photos go even when the background art has no boxes. Decorative only;
 * it never takes the pointer, so the cards above keep every gesture.
 */
export function SheetGuides({ mode, className }: { mode: PrintMode; className?: string }) {
  return (
    <svg
      aria-hidden
      data-testid="sheet-guides"
      data-mode={mode}
      viewBox={`0 0 ${SHEET.width} ${SHEET.height}`}
      preserveAspectRatio="none"
      className={className ?? 'pointer-events-none absolute inset-0 h-full w-full'}
    >
      {guideBoxes(mode).map((box) => (
        <rect
          key={box.id}
          data-testid={`guide-${box.id}`}
          x={box.rect.left}
          y={box.rect.top}
          width={box.rect.width}
          height={box.rect.height}
          rx={box.radius}
          ry={box.radius}
          fill="rgb(120 113 108 / 0.28)"
          stroke="rgb(87 83 78 / 0.55)"
          strokeWidth={3}
          strokeDasharray="14 10"
        />
      ))}
    </svg>
  )
}
