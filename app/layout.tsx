import type { Metadata, Viewport } from 'next'
import { Geist, Outfit } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })
const outfit = Outfit({ subsets: ['latin'], variable: '--font-display', weight: ['400','600','700','800','900'] })

export const metadata: Metadata = {
  title: 'AroStats',
  description: 'Planillaje deportivo interactivo',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#060C1A',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.variable} ${outfit.variable} antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
