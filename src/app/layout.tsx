import { FacebookPixel } from '@/components/_facebook-pixel'
import { SecurityScripts } from '@/components/_security-scripts'
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const DIN = localFont({
  src: [
    {
      path: '../../public/fonts/D-DIN.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/D-DIN-Italic.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../public/fonts/D-DIN-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
})

export const metadata: Metadata = {
  title: 'Starlink',
  description:
    'Internet, ligações e sms ILIMITADOS PARA SEMPRE em qualquer lugar do mundo, sem recargas ou mensalidades.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${DIN.className} antialiased`}>
        {process.env.NODE_ENV !== 'development' && (
          <>
            <SecurityScripts />
            <FacebookPixel />
          </>
        )}
        {children}
      </body>
    </html>
  )
}
