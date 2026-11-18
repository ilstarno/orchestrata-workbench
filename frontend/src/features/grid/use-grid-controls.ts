import { useState } from 'react'
import type { GridView } from './grid-contract'

export function useGridControls<SortKey extends string>(pageSize?: number) {
  const [draftSearch, setDraftSearch] = useState('')
  const [view, setView] = useState<GridView<SortKey>>({
    page: 1,
    pageSize,
    query: '',
    sort: undefined,
  })
  return { draftSearch, setDraftSearch, view, setView }
}
