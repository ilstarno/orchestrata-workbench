import { useEffect, useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { functionalUpdate, type OnChangeFn, type SortingState } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useLocale } from '../../shared/i18n/locale-context'
import { gridQueryOptions } from './grid-api'
import type { GridDataSource } from './grid-contract'
import { type ComponentProps } from 'react'
import { useGridControls } from './use-grid-controls'
import { GridTable } from './grid-table'
import './server-grid.css'

const SEARCH_DELAY_MS = 300

interface ServerGridProps<SortKey extends string> {
  source: GridDataSource<SortKey>
  title: string
  searchLabel: string
  pageSize?: number
  controls?: ReturnType<typeof useGridControls<SortKey>>
  renderCell?: ComponentProps<typeof GridTable>['renderCell']
}

export function ServerGrid<SortKey extends string>({ source, title, searchLabel, pageSize, controls, renderCell }: ServerGridProps<SortKey>) {
  const searchId = useId()
  const { locale, t } = useLocale()
  const defaultControls = useGridControls<SortKey>(pageSize)
  const { draftSearch, setDraftSearch, view, setView } = controls ?? defaultControls
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } =
    useQuery(gridQueryOptions(source, view))

  useEffect(() => {
    if (draftSearch === view.query) return
    const timer = setTimeout(() => {
      setView(current => ({ ...current, query: draftSearch, page: 1 }))
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [draftSearch, view.query, setView])

  const sorting = view.sort ? [view.sort] : []
  const onSortingChange: OnChangeFn<SortingState> = updater => {
    setView(current => {
      const next = functionalUpdate(updater, current.sort ? [current.sort] : [])[0]
      if (!next) return { ...current, page: 1, sort: undefined }
      if (!source.isSortKey(next.id)) return current
      return { ...current, page: 1, sort: { id: next.id, desc: next.desc } }
    })
  }
  const lastPage = Math.max(1, Math.ceil((data?.totalItems ?? 0) / (data?.pageSize ?? 1)))
  const visiblePage = Math.min(data?.page ?? view.page, lastPage)
  useEffect(() => {
    if (!data || isFetching || isPlaceholderData || view.page <= lastPage) return
    setView(current => current === view ? { ...current, page: lastPage } : current)
  }, [data, isFetching, isPlaceholderData, lastPage, setView, view])
  const controlsBusy = isFetching || draftSearch !== view.query
  const resultCount = data?.totalItems ?? 0
  const formatNumber = new Intl.NumberFormat(locale)
  const count = { count: formatNumber.format(resultCount) }
  const plural = new Intl.PluralRules(locale).select(resultCount)
  const resultCountKey = plural === 'one' ? 'resultCountOne' : plural === 'few' ? 'resultCountFew'
    : plural === 'many' ? 'resultCountMany' : 'resultCountOther'
  const statusText = isPending ? t('grid', 'loading') : isFetching
    ? t('grid', isPlaceholderData ? 'updatingPrevious' : 'updating')
    : data ? `${t('grid', 'page', { page: formatNumber.format(visiblePage), lastPage: formatNumber.format(lastPage) })} ${t('grid', resultCountKey, count)}` : ''

  return (
    <section className="server-grid" aria-label={title}>
      <div className="server-grid__toolbar">
        <label htmlFor={searchId}>
          {searchLabel}
          <span className="server-grid__search">
            <Search aria-hidden size={18} />
            <input
              id={searchId}
              type="search"
              value={draftSearch}
              onChange={event => setDraftSearch(event.currentTarget.value)}
            />
          </span>
        </label>
        <p className="server-grid__status" role="status">{statusText}</p>
      </div>
      {isError && (
        <div className="server-grid__error">
          <p className="error" role="alert">{t('grid', 'loadError')}</p>
          <button
            className="server-grid__button"
            type="button"
            onClick={() => void refetch()}
            disabled={controlsBusy}
          >{t('grid', 'retry')}</button>
        </div>
      )}
      <GridTable title={title} data={data} sorting={isPlaceholderData ? [] : sorting}
        onSortingChange={onSortingChange} busy={controlsBusy} renderCell={renderCell} />
      {data && (
        <nav className="server-grid__pagination" aria-label={t('grid', 'pagination')}>
          <button
            className="server-grid__button"
            type="button"
            disabled={controlsBusy || visiblePage <= 1}
            onClick={() => setView(current => ({ ...current, page: visiblePage - 1 }))}
          ><ChevronLeft size={15} aria-hidden /> {t('grid', 'previous')}</button>
          <button
            className="server-grid__button"
            type="button"
            disabled={controlsBusy || visiblePage >= lastPage}
            onClick={() => setView(current => ({ ...current, page: visiblePage + 1 }))}
          >{t('grid', 'next')} <ChevronRight size={15} aria-hidden /></button>
        </nav>
      )}
    </section>
  )
}
