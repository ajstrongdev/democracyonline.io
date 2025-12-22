import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import * as TanstackQuery from './integrations/tanstack-query/root-provider'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { AuthProvider } from '@/lib/auth-context'
import { routeTree } from './routeTree.gen'

export const getRouter = () => {
  const rqContext = TanstackQuery.getContext()

  const router = createRouter({
    routeTree,
    context: {
      ...rqContext,
      auth: {
        user: null,
        loading: true,
      },
    },
    defaultPreload: 'intent',
    Wrap: ({ children }) => (
      <TanstackQuery.Provider {...rqContext}>
        <AuthProvider>{children}</AuthProvider>
      </TanstackQuery.Provider>
    ),
  })

  onAuthStateChanged(auth, (user) => {
    router.update({
      context: {
        ...rqContext,
        auth: {
          user,
          loading: false,
        },
      },
    })
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient: rqContext.queryClient,
  })

  return router
}
