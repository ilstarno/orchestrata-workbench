// Presentation data; wire operations and resource types live in the generated API file.
export interface GridColumn {
  id: string
  label: string
  sortable: boolean
}

export type GridCell = string | number | boolean | null

export interface GridRow {
  id: string
  cells: Record<string, GridCell>
}

export interface GridPage {
  columns: GridColumn[]
  rows: GridRow[]
  page: number
  pageSize: number
  totalItems: number
}

export interface GridView<SortKey extends string> {
  page: number
  pageSize?: number
  query: string
  sort: { id: SortKey; desc: boolean } | undefined
}

export interface GridDataSource<SortKey extends string> {
  cacheKey: string
  isSortKey(value: string): value is SortKey
  fetchPage(view: GridView<SortKey>, signal: AbortSignal): Promise<GridPage>
}
