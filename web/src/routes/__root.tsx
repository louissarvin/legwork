import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import HeroUIProvider from '../providers/HeroUIProvider'
import WalletProvider from '../providers/WalletProvider'
import LenisSmoothScrollProvider from '../providers/LenisSmoothScrollProvider'
import Navbar from '../components/Navbar'
import StatusBar from '../components/StatusBar'
import ErrorPage from '../components/ErrorPage'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  errorComponent: ({ error, reset }) => <ErrorPage error={error} reset={reset} />,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Legwork - AI Agents Hire' },
      { name: 'description', content: 'The reverse gig economy. AI agents hire humans, pay instantly.' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/assets/legwork.svg' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument(_props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){document.documentElement.classList.add('dark')})();`,
          }}
        />
      </head>
      <body className="bg-page text-text-primary antialiased">
        <WalletProvider>
          <HeroUIProvider>
            <LenisSmoothScrollProvider />
            <Navbar />
            <main className="pt-16 pb-8 min-h-screen">
              <Outlet />
            </main>
            <StatusBar />
          </HeroUIProvider>
        </WalletProvider>
        <Scripts />
      </body>
    </html>
  )
}
