import { headers, sourceRows, type Workbook } from '../assignment/spreadsheet/workbook'

export const schema = {
  work_orders: { id: 'id' },
  technicians: { id: 'id', capacity_slots: 'u32', available: 'bool' },
  eligibility: {
    work_order_id: 'id',
    technician_id: 'id',
    cost_cents: 'u32',
    delay_minutes: 'u32',
  },
} as const
export type Table = keyof typeof schema
export const tables = Object.keys(schema) as Table[]
export type Records = Record<Table, Record<string, unknown>[]>
export type Mapping = Record<
  Table,
  { sheet: number | null; columns: Record<string, number | null> }
>
export interface Issue {
  table: Table
  row?: number
  field?: string
  code: 'mapping' | 'duplicate' | 'type' | 'reference' | 'limit' | 'extra'
}
export interface Review {
  records: Records
  rows: Record<Table, number[]>
  issues: Issue[]
}
export const fields = (table: Table) => Object.keys(schema[table])
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function convertCell(table: Table, field: string, value: string): unknown {
  const kind = (schema[table] as Record<string, string>)[field]
  if (kind === 'bool' && /^(true|false)$/i.test(value.trim()))
    return value.trim().toLowerCase() === 'true'
  if (kind === 'u32' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return value
}

export function suggestMapping(book: Workbook): Mapping {
  return Object.fromEntries(
    tables.map((table) => {
      const candidates = book.sheets
        .map((sheet, index) => ({ sheet, index }))
        .filter(({ sheet }) =>
          fields(table).every(
            (field) => headers(sheet).filter((header) => header === field).length === 1,
          ),
        )
      const named = book.sheets
        .map((sheet, index) => ({ sheet, index }))
        .filter(({ sheet }) => sheet.name === table)
      const exact = candidates.filter(({ sheet }) => headers(sheet).length === fields(table).length)
      const match = named.length
        ? named.length === 1 && candidates.some((candidate) => candidate.index === named[0].index)
          ? named[0]
          : undefined
        : exact.length === 1
          ? exact[0]
          : undefined
      return [
        table,
        {
          sheet: match?.index ?? null,
          columns: Object.fromEntries(
            fields(table).map((field) => [
              field,
              match ? headers(match.sheet).indexOf(field) : null,
            ]),
          ),
        },
      ]
    }),
  ) as Mapping
}

export function reviewWorkbook(book: Workbook, mapping: Mapping): Review {
  const records: Records = { work_orders: [], technicians: [], eligibility: [] }
  const rows: Record<Table, number[]> = { work_orders: [], technicians: [], eligibility: [] }
  const issues: Issue[] = [],
    usedSheets = new Set<number>()
  for (const table of tables) {
    const selection = mapping[table],
      sheet = selection.sheet === null ? undefined : book.sheets[selection.sheet]
    const columns = fields(table).map((field) => selection.columns[field])
    if (
      !sheet ||
      columns.some(
        (column) =>
          column === null ||
          !Number.isInteger(column) ||
          column < 0 ||
          column >= headers(sheet).length,
      )
    ) {
      issues.push({ table, code: 'mapping' })
      continue
    }
    if (usedSheets.has(selection.sheet!) || new Set(columns).size !== columns.length) {
      issues.push({ table, code: 'duplicate' })
      continue
    }
    usedSheets.add(selection.sheet!)
    for (const source of sourceRows(sheet)) {
      records[table].push(
        Object.fromEntries(
          fields(table).map((field) => [
            field,
            convertCell(table, field, source.cells[selection.columns[field]!] ?? ''),
          ]),
        ),
      )
      rows[table].push(source.row)
    }
  }
  return { records, rows, issues: issues.length ? issues : validateRecords(records) }
}

/** Structural extraction preserves invalid field values for targeted review. */
export function extractRecords(value: unknown): Records {
  if (!isRecord(value)) throw new Error('Invalid records')
  if (Object.keys(value).length === 1 && isRecord(value.tables)) {
    value = Object.fromEntries(
      Object.entries(value.tables).map(([name, wrapper]) => {
        if (
          !isRecord(wrapper) ||
          Object.keys(wrapper).length !== 1 ||
          !Array.isArray(wrapper.records)
        )
          throw new Error('Invalid table')
        return [name, wrapper.records]
      }),
    )
  }
  if (
    !isRecord(value) ||
    Object.keys(value).length !== tables.length ||
    !tables.every((table) => Array.isArray(value[table]))
  )
    throw new Error('Invalid named tables')
  if (tables.reduce((sum, table) => sum + (value[table] as unknown[]).length, 0) > 128)
    throw new Error('Record limit')
  if (!tables.every((table) => (value[table] as unknown[]).every(isRecord)))
    throw new Error('Invalid record')
  return value as Records
}

export function validateRecords(records: Records): Issue[] {
  const issues: Issue[] = []
  if (
    tables.reduce((sum, table) => sum + records[table].length, 0) > 128 ||
    records.work_orders.length > 32 ||
    records.technicians.length > 32
  )
    return [{ table: 'work_orders', code: 'limit' }]
  for (const table of tables) {
    const seen = new Set<string>()
    records[table].forEach((row, index) => {
      const issue = (code: Issue['code'], field?: string) =>
        issues.push({ table, row: index, field, code })
      if (Object.keys(row).some((field) => !fields(table).includes(field))) issue('extra')
      for (const field of fields(table)) {
        const value = row[field],
          kind = (schema[table] as Record<string, string>)[field]
        if (
          kind === 'id'
            ? typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)
            : kind === 'bool'
              ? typeof value !== 'boolean'
              : typeof value !== 'number' ||
                !Number.isInteger(value) ||
                value < 0 ||
                value > 1000000
        )
          issue('type', field)
      }
      const identity =
        table === 'eligibility'
          ? JSON.stringify([row.work_order_id, row.technician_id])
          : JSON.stringify(row.id)
      if (seen.has(identity)) issue('duplicate', table === 'eligibility' ? 'technician_id' : 'id')
      seen.add(identity)
    })
  }
  const orders = new Set(records.work_orders.map((row) => row.id)),
    technicians = new Set(records.technicians.map((row) => row.id))
  records.eligibility.forEach((row, index) => {
    if (!orders.has(row.work_order_id))
      issues.push({ table: 'eligibility', row: index, field: 'work_order_id', code: 'reference' })
    if (!technicians.has(row.technician_id))
      issues.push({ table: 'eligibility', row: index, field: 'technician_id', code: 'reference' })
  })
  return issues
}
