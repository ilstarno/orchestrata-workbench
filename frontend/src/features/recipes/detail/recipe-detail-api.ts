import createClient from 'openapi-fetch'
import type { paths } from '../../../shared/api/generated/orchestrata'
import { decodeSolveFailure, parseSolveResult, SolveError } from '../../../shared/api/solve'
import { parseRecipePreview } from './recipe-preview'

export function createRecipeDetailApi(baseUrl = '') {
  const client = createClient<paths>({
    baseUrl,
    fetch: (request) => fetch(request),
    headers: { Accept: 'application/json' },
  })

  return {
    async preview(recipeId: string, signal?: AbortSignal) {
      const params = { path: { recipe_id: recipeId } }
      const [metadata, example] = await Promise.all([
        client.GET('/api/v1/recipes/{recipe_id}', { params, signal }),
        client.GET('/api/v1/recipes/{recipe_id}/example', { params, signal, parseAs: 'text' }),
      ])
      if (!metadata.response.ok || !example.response.ok || example.data === undefined) {
        throw new Error('Recipe preview unavailable')
      }
      return parseRecipePreview(recipeId, metadata.data, example.data)
    },
    async run(recipeId: string, signal?: AbortSignal) {
      let result
      try {
        result = await client.POST('/api/v1/recipes/{recipe_id}/run-example', {
          params: { path: { recipe_id: recipeId } },
          parseAs: 'text',
          signal,
        })
      } catch {
        throw new SolveError('offline')
      }
      if (!result.response.ok) throw await decodeSolveFailure(result.response)
      if (result.response.status !== 200) throw new SolveError('unexpected-response')
      return parseSolveResult(result.data ?? '')
    },
  }
}

export const recipeDetailApi = createRecipeDetailApi()
