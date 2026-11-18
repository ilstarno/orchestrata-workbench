import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { GridDataSource, GridView } from './grid-contract'

export function gridQueryOptions<SortKey extends string>(source: GridDataSource<SortKey>, view: GridView<SortKey>) {
  return queryOptions({
    queryKey: ['grid', source.cacheKey, view],
    queryFn: ({ signal }) => source.fetchPage(view, signal),
    placeholderData: previous => keepPreviousData(previous),
    retry: false,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
