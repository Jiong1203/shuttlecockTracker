'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { usePathname } from 'next/navigation'

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname()
  const isManual = pathname?.startsWith('/manual')

  if (isManual) {
    return (
      <>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (!sessionStorage.getItem('manual-isolated')) {
                  var t = localStorage.getItem('theme');
                  if (t) localStorage.setItem('manual-theme', t);
                  sessionStorage.setItem('manual-isolated', '1');
                }
              } catch (e) {}
            `
          }}
        />
        <NextThemesProvider {...props} storageKey="manual-theme">
          {children}
        </NextThemesProvider>
      </>
    )
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
