import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@renderer/shared/utils/cn'

/** Laptop button (shadcn pattern). Black filled primary, ghost secondary, 44 px minimum touch target. */
const buttonVariants = cva(
  [
    'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-field)]',
    'px-5 text-sm font-medium whitespace-nowrap transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-ink hover:bg-primary/90',
        ghost: 'border border-line bg-transparent text-ink hover:bg-bg-raised',
        danger: 'bg-danger text-primary-ink hover:bg-danger/90',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />
}
