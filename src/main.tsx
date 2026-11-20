import { Auth0Provider, type AppState } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './index.css'
import { auth0Config, isAuthConfigured } from './lib/auth-config.ts'
import { SessionProvider } from './lib/session.tsx'
import { AuthSetupNotice } from './pages/AuthSetupNotice.tsx'
import { router } from './router.tsx'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

// After Auth0 redirects back, continue to the page the user originally asked for.
const onRedirectCallback = (appState?: AppState) => {
  router.navigate(appState?.returnTo ?? '/', { replace: true })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAuthConfigured ? (
      <Auth0Provider
        domain={auth0Config.domain!}
        clientId={auth0Config.clientId!}
        authorizationParams={{
          redirect_uri: window.location.origin,
          audience: auth0Config.audience,
          scope: 'openid profile email offline_access',
        }}
        // Refresh tokens + localStorage keep technicians signed in on phones
        // (Safari blocks the third-party cookies silent auth would need).
        useRefreshTokens
        cacheLocation="localstorage"
        onRedirectCallback={onRedirectCallback}
      >
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <RouterProvider router={router} />
          </SessionProvider>
        </QueryClientProvider>
      </Auth0Provider>
    ) : (
      <AuthSetupNotice />
    )}
  </StrictMode>,
)
