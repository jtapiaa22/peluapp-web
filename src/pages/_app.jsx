import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>PeluqueriaApp - Turnos Web</title>
        <meta name="description" content="Reservas online para tu peluquería" />
        <link rel="icon" href="icon/icon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
