import * as AvatarPrimitive from '@radix-ui/react-avatar'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva } from 'class-variance-authority'
import { ChevronDown, X } from 'lucide-react'
import React from 'react'

import { cn } from '../lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        outline: 'border border-border bg-background hover:bg-muted',
        ghost: 'hover:bg-muted text-foreground',
        destructive: 'bg-red-600 text-white hover:bg-red-500',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export function Card({ className, ...props }) {
  return <div className={cn('rounded-2xl border border-slate-200 bg-white shadow-soft', className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('space-y-1 p-6 pb-4', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-lg font-semibold tracking-tight text-slate-900', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-6 pt-0', className)} {...props} />
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'flex min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function Badge({ className, variant = 'default', ...props }) {
  const variantStyles = {
    default: 'bg-blue-100 text-blue-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-red-100 text-red-700',
    muted: 'bg-slate-100 text-slate-700',
  }
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', variantStyles[variant], className)} {...props} />
}

export function Tabs({ defaultValue, className, ...props }) {
  return <TabsPrimitive.Root defaultValue={defaultValue} className={cn('w-full', className)} {...props} />
}

export function TabsList({ className, ...props }) {
  return <TabsPrimitive.List className={cn('inline-flex h-10 items-center rounded-xl bg-slate-100 p-1', className)} {...props} />
}

export function TabsTrigger({ className, ...props }) {
  return <TabsPrimitive.Trigger className={cn('inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-all hover:text-slate-900 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm', className)} {...props} />
}

export function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content className={cn('mt-4', className)} {...props} />
}

export function Select({ children, value, onValueChange, placeholder, className }) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger className={cn('flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500', className)}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export function SelectItem({ value, children }) {
  return <SelectPrimitive.Item value={value} className="relative flex cursor-pointer select-none items-center rounded-lg px-2 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100 data-[highlighted]:bg-slate-100">
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
}

export function Dialog({ open, onOpenChange, title, description, children }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/30" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          {(title || description) && (
            <div className="mb-4 space-y-1">
              {title && <DialogPrimitive.Title className="text-lg font-semibold text-slate-900">{title}</DialogPrimitive.Title>}
              {description && <DialogPrimitive.Description className="text-sm text-slate-600">{description}</DialogPrimitive.Description>}
            </div>
          )}
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function DropdownMenu({ trigger, items, className }) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content align="end" sideOffset={8} className={cn('z-50 min-w-[180px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl', className)}>
          {items.map((item, index) => (
            <DropdownMenuPrimitive.Item key={index} className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-100">
              {item}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  )
}

export function Avatar({ className, initials }) {
  return (
    <AvatarPrimitive.Root className={cn('flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white', className)}>
      <AvatarPrimitive.Image />
      <AvatarPrimitive.Fallback>{initials}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
