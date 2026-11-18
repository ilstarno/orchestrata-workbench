import { type ReactNode, useId, useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useLocale } from '../../shared/i18n/locale-context'
import type { GridPage, GridRow } from './grid-contract'

interface GridTableProps {
  title: string
  data: GridPage | undefined
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  busy?: boolean
  renderCell?: (row: GridRow, columnId: string) => ReactNode
}

export function GridTable({
  title,
  data,
  sorting,
  onSortingChange,
  busy = false,
  renderCell,
}: GridTableProps) {
  const captionId = useId()
  const { t } = useLocale()
  const columns = useMemo<ColumnDef<GridRow, unknown>[]>(
    () =>
      (data?.columns ?? []).map((meta) => ({
        id: meta.id,
        header: meta.label,
        accessorFn: (row) => row.cells[meta.id],
        enableSorting: meta.sortable,
        sortDescFirst: false,
        cell: (info) => {
          const value = info.getValue()
          const content = renderCell?.(info.row.original, meta.id)
          if (content != null) return content
          return value === null ? '—' : String(value)
        },
      })),
    [data?.columns, renderCell],
  )
  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
    onSortingChange,
    enableSortingRemoval: false,
    enableMultiSort: false,
  })

  if (!data) return null

  return (
    <div className="server-grid__overflow" role="region" aria-labelledby={captionId} tabIndex={0}>
      <table aria-busy={busy}>
        <caption className="sr-only" id={captionId}>
          {title}
        </caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const column = header.column
                const direction = column.getIsSorted()
                const label = flexRender(column.columnDef.header, header.getContext())
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      direction === 'asc'
                        ? 'ascending'
                        : direction === 'desc'
                          ? 'descending'
                          : undefined
                    }
                  >
                    {column.getCanSort() ? (
                      <button
                        className="server-grid__sort"
                        type="button"
                        disabled={busy}
                        onClick={column.getToggleSortingHandler()}
                      >
                        <span lang="">{label}</span>
                        {direction === 'asc' ? (
                          <ArrowUp aria-hidden size={14} />
                        ) : direction === 'desc' ? (
                          <ArrowDown aria-hidden size={14} />
                        ) : (
                          <ArrowUpDown aria-hidden size={14} />
                        )}
                      </button>
                    ) : (
                      <span lang="">{label}</span>
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} lang="">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {data.rows.length === 0 && (
            <tr>
              <td className="server-grid__empty" colSpan={columns.length}>
                {t('grid', 'noResults')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
