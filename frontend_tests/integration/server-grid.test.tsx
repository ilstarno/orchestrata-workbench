import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gridQueryOptions } from '../../frontend/src/features/grid/grid-api'
import type { GridView } from '../../frontend/src/features/grid/grid-contract'
import { GridTable } from '../../frontend/src/features/grid/grid-table'
import { createRecipeGridSource } from '../../frontend/src/features/recipes/recipe-grid-api'
import type { components } from '../../frontend/src/shared/api/generated/orchestrata'

const source = createRecipeGridSource('https://test.invalid')
const firstView: GridView<components['schemas']['RecipeGridSort']> = {
  page: 1, pageSize: 25, query: '', sort: undefined,
}
const serverPage = {
  columns: [
    { id: 'scenario', label: 'Server description', sortable: false },
    { id: 'title', label: 'Server heading', sortable: true },
    { id: 'id', label: 'Server identifier', sortable: true },
  ],
  items: [{ id: 'first', title: 'Zulu', scenario: '<script>not markup</script>' }, {
    id: 'second', title: 'Alpha', scenario: 'Shown second',
  }],
  page: 1,
  page_size: 25,
  total_items: 2,
} satisfies components['schemas']['RecipeGridResponse']

function mockPage(data = serverPage) {
  const fetcher = vi.fn<(request: Request) => Promise<Response>>()
  fetcher.mockImplementation(async () => Response.json(data))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

afterEach(() => vi.unstubAllGlobals())

describe('OpenAPI-driven grid', () => {
  it('passes the page, literal query, sort, and abort signal to the server', async () => {
    const fetcher = mockPage()
    const abort = new AbortController()
    const view = { ...firstView, page: 2, query: 'a+b & c', sort: { id: 'title' as const, desc: true } }
    await source.fetchPage(view, abort.signal)

    expect(fetcher).toHaveBeenCalledTimes(1)
    const [request] = fetcher.mock.calls[0]
    const url = new URL(request.url)
    expect(url.pathname).toBe('/api/v1/recipes/grid')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: '2', page_size: '25', q: 'a+b & c', sort: 'title', direction: 'desc',
    })
    expect(request.signal.aborted).toBe(false)
    abort.abort()
    expect(request.signal.aborted).toBe(true)
  })

  it('deduplicates concurrent reads and does not retry a failing request', async () => {
    const fetcher = mockPage()
    const client = new QueryClient()
    const query = gridQueryOptions(source, firstView)
    await Promise.all([client.fetchQuery(query), client.fetchQuery(query)])
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockResolvedValue(new Response(null, { status: 503 }))
    await expect(client.fetchQuery(gridQueryOptions(source, { ...firstView, query: 'next' })))
      .rejects.toThrow('Grid request failed')
    expect(fetcher).toHaveBeenCalledTimes(2)
    client.clear()
  })

  it('retains the previous page during a change and aborts the abandoned request', async () => {
    const fetcher = mockPage()
    const client = new QueryClient()
    const options = gridQueryOptions(source, firstView)
    const first = await client.fetchQuery(options)
    const observer = new QueryObserver(client, options)
    const unsubscribe = observer.subscribe(() => undefined)
    let pendingSignal: AbortSignal | undefined
    fetcher.mockImplementation(request => new Promise((_resolve, reject) => {
      pendingSignal = request.signal
      pendingSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))

    observer.setOptions(gridQueryOptions(source, { ...firstView, page: 2 }))
    expect(observer.getCurrentResult().isPlaceholderData).toBe(true)
    expect(observer.getCurrentResult().data).toBe(first)
    expect(pendingSignal?.aborted).toBe(false)
    unsubscribe()
    expect(pendingSignal?.aborted).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
    client.clear()
  })

  it('renders server column order and labels without sorting rows in the browser', async () => {
    mockPage()
    const page = await source.fetchPage(firstView, new AbortController().signal)
    const markup = renderToStaticMarkup(
      <GridTable title="Recipe results" data={page} sorting={[{ id: 'title', desc: false }]}
        onSortingChange={() => undefined} />,
    )

    expect(markup.indexOf('Server description')).toBeLessThan(markup.indexOf('Server heading'))
    expect(markup.indexOf('Zulu')).toBeLessThan(markup.indexOf('Alpha'))
    expect(markup).toContain('aria-sort="ascending"')
    expect(markup.match(/<button/g)).toHaveLength(2)
    expect(markup).toContain('&lt;script&gt;')
    expect(markup).not.toContain('<script>')
  })

  it('keeps explicit empty data without a parallel field list', async () => {
    const fetcher = mockPage({ ...serverPage, items: [], total_items: 0 })
    const empty = await source.fetchPage(firstView, new AbortController().signal)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(empty.rows).toEqual([])
    expect(empty.columns.map(column => column.id)).toEqual(['scenario', 'title', 'id'])
    expect(source.isSortKey('scenario')).toBe(false)
    expect(source.isSortKey('title')).toBe(true)
  })
})
