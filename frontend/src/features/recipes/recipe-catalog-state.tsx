import { createContext, useContext, type ReactNode } from 'react'
import type { components } from '../../shared/api/generated/orchestrata'
import { useGridControls } from '../grid/use-grid-controls'

const RecipeCatalogContext = createContext<ReturnType<typeof useGridControls<components['schemas']['RecipeGridSort']>> | undefined>(undefined)

export function RecipeCatalogProvider({ children }: { children: ReactNode }) {
  const controls = useGridControls<components['schemas']['RecipeGridSort']>()
  return <RecipeCatalogContext.Provider value={controls}>{children}</RecipeCatalogContext.Provider>
}

export function useRecipeCatalogControls() {
  return useContext(RecipeCatalogContext)
}
