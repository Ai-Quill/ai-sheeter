import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { poppins } from '@/app/fonts'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <main className={`${poppins.variable} font-sans`}>
      <Component {...pageProps} />
    </main>
  )
}