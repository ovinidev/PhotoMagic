import { useEffect, useRef } from 'react'
import { MIN_SLOT_SIZE, PHOTO_INDEXES, roundSlot, type PhotoIndex, type Slot } from '@shared/layout'
import { cn } from '@renderer/shared/utils/cn'
import { LAYOUT_COPY } from '../copy'
import { NUMBER_FIELDS, fieldKey, paintSlot, type LiveRegistry, type NumberField } from '../utils/livePaint'
import { boxSlotId } from '../utils/boxes'
import { photoColor } from '../utils/slotColors'

/** The fixed gray boxes never turn: their table has no Image and no Angle column. */
const BOX_FIELDS = NUMBER_FIELDS.filter((field) => field !== 'angle')

/** A typed number for a field, or `null` while the text is not a valid value yet. */
function parseField(field: NumberField, text: string): number | null {
  if (!/^-?\d+$/.test(text.trim())) return null
  const value = Number(text)
  if (!Number.isFinite(value)) return null
  if ((field === 'width' || field === 'height') && value < MIN_SLOT_SIZE) return null
  return value
}

/**
 * One number of one slot. Uncontrolled: the drag writes `value` directly (`paintSlot`), typing moves
 * the card live through the same path, and Enter or leaving the field commits one step.
 */
function SlotNumber({
  slot,
  field,
  registry,
  onSelect,
  onCommit,
}: {
  slot: Slot
  field: NumberField
  registry: LiveRegistry
  onSelect: () => void
  onCommit: (slot: Slot) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const key = fieldKey(slot.id, field)
  const value = slot[field]
  const label = LAYOUT_COPY.fieldLabel(LAYOUT_COPY.columns[field], LAYOUT_COPY.itemLabel(slot.id))

  useEffect(() => {
    const input = ref.current
    if (!input) return
    registry.fields.set(key, input)
    return () => {
      registry.fields.delete(key)
    }
  }, [registry, key])

  // A committed change (release, Undo, Restaurar padrão) shows here, unless the operator is typing.
  useEffect(() => {
    const input = ref.current
    if (input && input !== document.activeElement) input.value = String(value)
  }, [value])

  const draft = (): Slot | null => {
    const parsed = parseField(field, ref.current?.value ?? '')
    return parsed === null ? null : roundSlot({ ...slot, [field]: parsed })
  }

  const commit = () => {
    const next = draft()
    if (next) onCommit(next)
    else {
      paintSlot(registry, slot)
      if (ref.current) ref.current.value = String(value)
    }
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      defaultValue={String(value)}
      aria-label={label}
      data-testid={`field-${slot.id.replace(':', '-')}-${field}`}
      className={cn(
        'h-7 w-full min-w-0 rounded-[6px] border border-line bg-bg-raised px-1.5 text-right text-[13px] text-ink tabular-nums',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
      )}
      onFocus={onSelect}
      onChange={() => {
        const next = draft()
        if (next) paintSlot(registry, next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') {
          event.stopPropagation()
          if (ref.current) ref.current.value = String(value)
          paintSlot(registry, slot)
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          const step = (event.shiftKey ? 10 : 1) * (event.key === 'ArrowUp' ? 1 : -1)
          const base = parseField(field, ref.current?.value ?? '') ?? value
          const next = parseField(field, String(base + step))
          if (next !== null) onCommit(roundSlot({ ...slot, [field]: next }))
        }
      }}
      onBlur={commit}
    />
  )
}

/**
 * The numbers panel, one row per slot, in the current app's order: Image, Left, Top, Width, Height,
 * Angle (Figure 5). Image picks photo 1, 2, 3 or `Nenhuma`. `variant="boxes"` is the same table for
 * the fixed gray boxes: Left, Top, Width and Height only.
 */
export function SlotTable({
  slots,
  selectedId,
  registry,
  onSelect,
  onCommit,
  variant = 'cards',
}: {
  slots: readonly Slot[]
  selectedId: string | null
  registry: LiveRegistry
  onSelect: (id: string) => void
  onCommit: (slot: Slot) => void
  variant?: 'cards' | 'boxes'
}) {
  const { columns } = LAYOUT_COPY
  const cards = variant === 'cards'
  const fields = cards ? NUMBER_FIELDS : BOX_FIELDS
  return (
    <table className="w-full table-fixed border-separate border-spacing-x-1 border-spacing-y-1 text-[13px]" data-testid={cards ? 'slot-table' : 'box-table'}>
      <colgroup>
        <col className="w-[68px]" />
        {cards ? <col className="w-[64px]" /> : null}
        {fields.map((field) => (
          <col key={field} />
        ))}
      </colgroup>
      <thead>
        <tr className="text-left text-xs font-medium text-ink-soft">
          <th scope="col" className="sr-only">
            {columns.slot}
          </th>
          {cards ? (
            <th scope="col" className="px-1 font-medium">
              {columns.photo}
            </th>
          ) : null}
          {fields.map((field) => (
            <th key={field} scope="col" className="px-1 text-right font-medium">
              {columns[field]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {slots.map((slot) => {
          const label = LAYOUT_COPY.slotLabel(boxSlotId(slot.id))
          const selected = slot.id === selectedId
          return (
            <tr key={slot.id} data-testid={`${cards ? 'slot' : 'box'}-row-${boxSlotId(slot.id)}`} aria-selected={selected} onPointerDown={() => onSelect(slot.id)}>
              <th
                scope="row"
                className={cn(
                  'rounded-[6px] px-1.5 text-left text-xs font-medium whitespace-nowrap',
                  selected ? 'bg-selection text-white' : 'text-ink',
                )}
              >
                <span
                  className="mr-1 inline-block size-2 rounded-full align-middle ring-1 ring-ink/20"
                  style={{ backgroundColor: cards ? photoColor(slot.photo).fill : 'rgb(120 113 108 / 0.6)' }}
                />
                {label}
              </th>
              {cards ? (
                <td>
                <select
                  aria-label={LAYOUT_COPY.fieldLabel(columns.photo, label)}
                  value={slot.photo ?? 'none'}
                  onFocus={() => onSelect(slot.id)}
                  onChange={(event) => {
                    const value = event.target.value
                    onCommit({ ...slot, photo: value === 'none' ? null : (Number(value) as PhotoIndex) })
                  }}
                  className={cn(
                    'h-7 w-full cursor-pointer rounded-[6px] border border-line bg-bg-raised px-1 text-[13px] text-ink',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
                  )}
                >
                  {PHOTO_INDEXES.map((photo) => (
                    <option key={photo} value={photo}>
                      {photo}
                    </option>
                  ))}
                  <option value="none">{LAYOUT_COPY.photoNone}</option>
                </select>
                </td>
              ) : null}
              {fields.map((field) => (
                <td key={field}>
                  <SlotNumber slot={slot} field={field} registry={registry} onSelect={() => onSelect(slot.id)} onCommit={onCommit} />
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
