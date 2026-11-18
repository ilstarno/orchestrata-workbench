import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { App } from '../../app'
import { RecipeCatalogProvider } from '../../features/recipes/recipe-catalog-state'
import { useLocale } from '../i18n/locale-context'

export function WorkbenchShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { t } = useLocale()
  const isAssignment = pathname === '/'
  return (
    <>
      <div hidden={!isAssignment}>
        <App
          recipeNavigation={
            <>
              <Link to="/" aria-current="page">
                {t('app-shell', 'assignment')}
              </Link>
              <Link to="/recipes">{t('app-shell', 'recipes')}</Link>
            </>
          }
        />
      </div>
      <RecipeCatalogProvider>
        <Outlet />
      </RecipeCatalogProvider>
    </>
  )
}
