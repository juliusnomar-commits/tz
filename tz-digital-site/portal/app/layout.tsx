import type { Metadata } from 'next'
import './portal.css'

export const metadata: Metadata = {
  title: 'Client Portal | TZ Digital',
  description: 'Your project with TZ Digital, all in one place.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
