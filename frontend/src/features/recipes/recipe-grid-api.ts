import createClient from 'openapi-fetch'
import { recipeGridSortValues, type components, type paths } from '../../shared/api/generated/orchestrata'
import type { GridDataSource } from '../grid/grid-contract'

const recipeGridPath = '/api/v1/recipes/grid' satisfies keyof paths

type RecipeGridQuery = NonNullable<paths[typeof recipeGridPath]['get']['parameters']['query']>
type RecipeGridSort = components['schemas']['RecipeGridSort']

function isSortKey(value: string): value is RecipeGridSort {
  return recipeGridSortValues.some(key => key === value)
}

export function createRecipeGridSource(baseUrl = ''): GridDataSource<RecipeGridSort> {
  const client = createClient<paths>({
    baseUrl,
    fetch: request => fetch(request),
    headers: { Accept: 'application/json' },
  })

  return {
    cacheKey: baseUrl + recipeGridPath,
    isSortKey,
    async fetchPage(view, signal) {
      const query: RecipeGridQuery = {
        page: view.page,
        page_size: view.pageSize,
        q: view.query || undefined,
        sort: view.sort?.id,
        direction: view.sort ? (view.sort.desc ? 'desc' : 'asc') : undefined,
      }
      const { data, response } = await client.GET(recipeGridPath, { signal, params: { query } })
      if (!response.ok || !data) throw new Error('Grid request failed')
      const columns = data.columns.map(column => ({
        ...column,
        sortable: column.sortable && isSortKey(column.id),
      }))
      const rows = data.items.map(item => ({
        id: item.id,
        cells: Object.fromEntries(columns.map(column => [column.id, item[column.id]])),
      }))
      return { columns, rows, page: data.page, pageSize: data.page_size, totalItems: data.total_items }
    },
  }
}

export const recipeGridSource = createRecipeGridSource()
