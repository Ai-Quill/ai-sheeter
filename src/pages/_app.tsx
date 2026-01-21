import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { poppins } from '@/app/fonts'
import Script from 'next/script'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Google Analytics */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-M3RFM0FM7H"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-M3RFM0FM7H');
        `}
      </Script>
      
      <main className={`${poppins.variable} font-sans`}>
        <Component {...pageProps} />
      </main>
    </>
  )
}