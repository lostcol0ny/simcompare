import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { GridBackground } from '@/components/GridBackground'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SimCompare',
  description: 'Compare Raidbots simulation reports side by side',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <GridBackground />
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  )
}
