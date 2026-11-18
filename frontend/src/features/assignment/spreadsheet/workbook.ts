export interface Sheet {
  name: string
  sourceRows: string[][]
  headingRow: number
}
export interface Workbook {
  sheets: Sheet[]
}
export class ImportError extends Error {
  constructor(
    readonly code:
      'invalid-file' | 'file-limit' | 'sheet-limit' | 'formula' | 'unsupported-file' | 'delimiter',
  ) {
    super(code)
  }
}
export function headers(sheet: Sheet): string[] {
  return sheet.sourceRows[sheet.headingRow - 1] ?? []
}
export function sourceRows(sheet: Sheet) {
  return sheet.sourceRows.flatMap((cells, index) =>
    index >= sheet.headingRow && cells.some((value) => value.trim())
      ? [{ cells, row: index + 1 }]
      : [],
  )
}
export function makeSheet(name: string, rows: unknown[][]): Sheet {
  if (
    rows.length > 204 ||
    rows.some((row) => row.length > 80 || row.some((cell) => String(cell ?? '').length > 8192))
  )
    throw new ImportError('sheet-limit')
  const width = Math.max(0, ...rows.map((row) => row.length))
  return {
    name,
    headingRow: 1,
    sourceRows: rows.map((row) =>
      Array.from({ length: width }, (_, column) => String(row[column] ?? '')),
    ),
  }
}
