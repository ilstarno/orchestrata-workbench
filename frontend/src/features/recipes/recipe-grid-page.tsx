import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { WorkbenchHeader } from '../../shared/workbench/workbench-header'
import { useLocale } from '../../shared/i18n/locale-context'
import { useTheme } from '../../shared/theme/use-theme'
import { ServerGrid } from '../grid/server-grid'
import type { GridRow } from '../grid/grid-contract'
import { useRecipeCatalogControls } from './recipe-catalog-state'
import { recipeGridSource } from './recipe-grid-api'
import '../../styles.css'

function renderRecipeCell(row: GridRow, columnId: string) {
  if (columnId !== 'title' || typeof row.cells.title !== 'string') return undefined
  return (
    <Link className="recipe-link" to="/recipes/$recipeId" params={{ recipeId: row.id }}>
      {row.cells.title}
    </Link>
  )
}

export function RecipeGridPage() {
  const { theme } = useTheme()
  const { t } = useLocale()
  const controls = useRecipeCatalogControls()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <div className="shell" data-theme={theme}>
      <WorkbenchHeader
        active="recipes"
        mainId="recipe-work"
        navigation={
          <>
            <Link to="/">{t('app-shell', 'assignment')}</Link>
            <Link to="/recipes" aria-current="page">
              {t('app-shell', 'recipes')}
            </Link>
          </>
        }
      />
      <main className="content" id="recipe-work" tabIndex={-1}>
        <div className="heading">
          <div>
            <h1 ref={heading} tabIndex={-1}>
              {t('recipe-grid', 'title')}
            </h1>
            <p>{t('recipe-grid', 'description')}</p>
          </div>
        </div>
        <ServerGrid
          controls={controls}
          source={recipeGridSource}
          title={t('recipe-grid', 'gridLabel')}
          searchLabel={t('recipe-grid', 'searchLabel')}
          renderCell={renderRecipeCell}
        />
      </main>
    </div>
  )
}
