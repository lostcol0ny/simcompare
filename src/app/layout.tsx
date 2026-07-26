import type { Metadata } from 'next'
import { Archivo, Martian_Mono } from 'next/font/google'
import { GridBackground } from '@/components/GridBackground'
import './globals.css'

const archivo = Archivo({ subsets: ['latin'], variable: '--font-archivo' })
const martianMono = Martian_Mono({ subsets: ['latin'], variable: '--font-martian' })

export const metadata: Metadata = {
  title: 'SimCompare',
  description: 'Compare Raidbots simulation reports side by side',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${martianMono.variable} font-sans`}>
        <GridBackground />
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  )
}
