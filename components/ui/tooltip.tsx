'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

const TooltipProvider = TooltipPrimitive.Provider
const TooltipRoot = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={[
        'z-50 overflow-hidden rounded-md bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5',
        'text-xs font-medium text-white shadow-md',
        'animate-in fade-in-0 zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

/** 方便使用的組合元件
 *  用 <span> 當觸發層，避免子元件需要 forwardRef 才能接收 Radix 事件
 */
function Tooltip({
  children,
  label,
  side = 'bottom',
  delayDuration = 300,
}: {
  children: React.ReactNode
  label: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delayDuration?: number
}) {
  return (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </TooltipRoot>
  )
}

export { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent, Tooltip }
