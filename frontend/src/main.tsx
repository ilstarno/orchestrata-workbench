import '@fontsource/ibm-plex-sans/latin-ext-400.css'
import '@fontsource/ibm-plex-sans/latin-ext-500.css'
import '@fontsource/ibm-plex-sans/latin-ext-600.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  RouterProvider,
} from '@tanstack/react-router'
import { WorkbenchShell } from './shared/workbench/workbench-shell'
import { LocaleProvider } from './shared/i18n/locale-context'

const rootRoute = createRootRoute({ component: WorkbenchShell })
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => null,
})
const recipesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes',
  component: lazyRouteComponent(
    () => import('./features/recipes/recipe-grid-page'),
    'RecipeGridPage',
  ),
})
const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recipes/$recipeId',
  component: lazyRouteComponent(
    () => import('./features/recipes/recipe-detail-page'),
    'RecipeDetailPage',
  ),
})
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, recipesRoute, detailRoute]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const client = new QueryClient()
const root = document.getElementById('root')

if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <RouterProvider router={router} />
      </LocaleProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
