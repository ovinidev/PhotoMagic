import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/shared/utils/cn'

/**
 * Laptop button (shadcn pattern). Black filled primary, ghost secondary. `default` size keeps the 44 px
 * touch target; `sm` is the 32 px desktop size of dense tool screens (the slot editor, DESIGN §7).
 */
const buttonVariants = cva(
  [
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-field)]',
    'font-medium whitespace-nowrap',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-ink hover:bg-primary/85',
        ghost: 'border border-line bg-transparent text-ink hover:bg-bg-raised',
        danger: 'bg-danger text-primary-ink hover:bg-danger/90',
      },
      size: {
        // Editorial label: small, semibold, widely spaced capitals (DESIGN §14, laptop).
        default: 'min-h-11 min-w-11 px-5 text-[12px] font-semibold tracking-[0.12em] uppercase',
        sm: 'h-8 min-w-8 px-3 text-[13px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
