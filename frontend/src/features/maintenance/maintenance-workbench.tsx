import { useLayoutEffect, useRef, useState } from 'react'
import { useLocale } from '../../shared/i18n/locale-context'
import { headers, sourceRows, type Workbook } from '../assignment/spreadsheet/workbook'
import { WorkbookPreview } from '../assignment/spreadsheet/workbook-preview'
import { columnLetter } from '../assignment/spreadsheet/column-letter'
import {
  fields,
  tables,
  convertCell,
  reviewWorkbook,
  suggestMapping,
  validateRecords,
  type Mapping,
  type Records,
  type Table,
} from './input-model'
import { readRecords } from './read-records'
import '../assignment/spreadsheet/spreadsheet.css'
import './maintenance.css'

type Source = 'xlsx' | 'csv' | 'records'
interface Draft {
  names: string
  book?: Workbook
  mapping?: Mapping
  records?: Records
}
export function MaintenanceWorkbench() {
  const { t } = useLocale()
  const reviewElement = useRef<HTMLFieldSetElement>(null)
  const focusCorrection = useRef(false)
  useLayoutEffect(() => {
    if (!focusCorrection.current) return
    focusCorrection.current = false
    reviewElement.current
      ?.querySelector<HTMLElement>('input[aria-invalid=true], input[data-confirm]')
      ?.focus()
  })
  const [source, setSource] = useState<Source>('xlsx')
  const [entrypoint, setEntrypoint] = useState<'cost' | 'delay'>('cost')
  const [files, setFiles] = useState<(File | undefined)[]>([])
  const [sourceVersion, setSourceVersion] = useState(0)
  const [draft, setDraft] = useState<Draft>()
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const active = useRef(false),
    inputs = useRef<(HTMLInputElement | null)[]>([])
  const review =
    draft?.book && draft.mapping
      ? reviewWorkbook(draft.book, draft.mapping)
      : draft?.records
        ? {
            records: draft.records,
            issues: validateRecords(draft.records),
            rows: Object.fromEntries(
              tables.map((table) => [table, draft.records![table].map((_, i) => i + 1)]),
            ) as Record<Table, number[]>,
          }
        : undefined
  function revise(next: Draft) {
    setDraft(next)
    setConfirmed(false)
    setError(false)
  }
  async function open() {
    if (active.current || files.filter(Boolean).length !== (source === 'csv' ? 3 : 1)) return
    active.current = true
    setBusy(true)
    setError(false)
    try {
      const selected = files as File[],
        names = selected.map((file) => file.name).join(' · ')
      if (source === 'records') revise({ names, records: await readRecords(selected[0]) })
      else {
        if (selected.some((file) => !(source === 'csv' ? /\.csv$/i : /\.xlsx$/i).test(file.name)))
          throw new Error('Unexpected source format')
        const { readWorkbook } = await import('../assignment/spreadsheet/file-reader')
        const books = await Promise.all(selected.map(readWorkbook))
        if (source === 'csv' && books.some((book) => book.sheets.length !== 1))
          throw new Error('Expected CSV tables')
        const book = {
          sheets: books.flatMap((book, index) =>
            book.sheets.map((sheet) =>
              source === 'csv' ? { ...sheet, name: tables[index] } : sheet,
            ),
          ),
        }
        revise({ names, book, mapping: suggestMapping(book) })
      }
      setSourceVersion((value) => value + 1)
    } catch {
      setError(true)
    } finally {
      setFiles([])
      inputs.current.forEach((input) => {
        if (input) input.value = ''
      })
      active.current = false
      setBusy(false)
    }
  }
  function correct(table: Table, row: number, field: string, value: string) {
    if (!draft) return
    focusCorrection.current = true
    const next = structuredClone(draft)
    if (next.records) next.records[table][row][field] = convertCell(table, field, value)
    else if (next.book && next.mapping) {
      const selected = next.mapping[table],
        sheet = next.book.sheets[selected.sheet!]
      sheet.sourceRows[sourceRows(sheet)[row].row - 1][selected.columns[field]!] = value
    }
    revise(next)
  }
  return (
    <section className="panel maintenance-workbench" aria-labelledby="maintenance-heading">
      <div className="panel-header">
        <h2 id="maintenance-heading">
          maintenance-shift <small>1.0.0</small>
        </h2>
      </div>
      <div className="import-content">
        <label className="maintenance-select">
          {t('maintenance', 'entrypoint')}
          <select
            value={entrypoint}
            onChange={(event) => setEntrypoint(event.target.value as 'cost' | 'delay')}
          >
            <option value="cost">{t('maintenance', 'cost')}</option>
            <option value="delay">{t('maintenance', 'delay')}</option>
          </select>
        </label>
        <p>{t('maintenance', entrypoint === 'cost' ? 'costDetail' : 'delayDetail')}</p>
        <p>{t('maintenance', 'constraints')}</p>
        <fieldset disabled={busy} className="import-upload">
          <legend>{t('maintenance', 'source')}</legend>
          <label className="maintenance-select">
            {t('maintenance', 'sourceType')}
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value as Source)
                setFiles([])
              }}
            >
              <option value="xlsx">{t('maintenance', 'xlsx')}</option>
              <option value="csv">{t('maintenance', 'csv')}</option>
              <option value="records">{t('maintenance', 'records')}</option>
            </select>
          </label>
          <p>{t('maintenance', source === 'records' ? 'recordsDetail' : 'sheetDetail')}</p>
          {(source === 'csv' ? tables : [source]).map((label, index) => (
            <label key={label}>
              {source === 'csv'
                ? label
                : t('maintenance', source === 'records' ? 'records' : 'xlsx')}
              <input
                type="file"
                ref={(node) => {
                  inputs.current[index] = node
                }}
                accept={
                  source === 'records'
                    ? '.json,application/json'
                    : source === 'csv'
                      ? '.csv,text/csv'
                      : '.xlsx'
                }
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  setFiles((current) => {
                    const next = [...current]
                    next[index] = file
                    return next
                  })
                }}
              />
            </label>
          ))}
          <button
            className="primary-button"
            type="button"
            disabled={files.filter(Boolean).length !== (source === 'csv' ? 3 : 1)}
            onClick={() => void open()}
          >
            {t('spreadsheet', 'open')}
          </button>
        </fieldset>
        {busy && <p role="status">{t('spreadsheet', 'checking')}</p>}
        {error && (
          <p role="alert" className="error">
            {t('maintenance', 'fileError')}
          </p>
        )}
        {draft && review && (
          <fieldset className="import-review" ref={reviewElement} disabled={busy}>
            <legend>{t('maintenance', 'review')}</legend>
            <p>{draft.names}</p>
            {draft.book && draft.mapping && (
              <div className="import-mapping">
                {tables.map((table) => (
                  <fieldset key={table}>
                    <legend lang="">{table}</legend>
                    <label>
                      {t('spreadsheet', 'sheet')}
                      <select
                        value={draft.mapping![table].sheet ?? ''}
                        onChange={(event) => {
                          const mapping = structuredClone(draft.mapping!),
                            sheet = event.target.value === '' ? null : Number(event.target.value)
                          mapping[table] = {
                            sheet,
                            columns: Object.fromEntries(
                              fields(table).map((field) => [field, null]),
                            ),
                          }
                          revise({ ...draft, mapping })
                        }}
                      >
                        <option value="">{t('spreadsheet', 'choose')}</option>
                        {draft.book!.sheets.map((sheet, index) => (
                          <option key={index} value={index}>
                            {sheet.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {draft.mapping![table].sheet !== null && (
                      <>
                        <label>
                          {t('spreadsheet', 'headingRow')}
                          <select
                            value={draft.book!.sheets[draft.mapping![table].sheet!].headingRow}
                            onChange={(event) => {
                              const book = structuredClone(draft.book!),
                                mapping = structuredClone(draft.mapping!)
                              book.sheets[mapping[table].sheet!].headingRow = Number(
                                event.target.value,
                              )
                              mapping[table].columns = Object.fromEntries(
                                fields(table).map((field) => [field, null]),
                              )
                              revise({ ...draft, book, mapping })
                            }}
                          >
                            {Array.from(
                              {
                                length: Math.min(
                                  4,
                                  draft.book!.sheets[draft.mapping![table].sheet!].sourceRows
                                    .length,
                                ),
                              },
                              (_, i) => (
                                <option key={i} value={i + 1}>
                                  {i + 1}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        {draft.book!.sheets[draft.mapping![table].sheet!].headingRow > 1 && (
                          <p>
                            {t('spreadsheet', 'skipped', {
                              count: String(
                                draft.book!.sheets[draft.mapping![table].sheet!].headingRow - 1,
                              ),
                            })}
                          </p>
                        )}
                        {fields(table).map((field) => (
                          <label key={field}>
                            <span lang="">{field}</span>
                            <select
                              value={draft.mapping![table].columns[field] ?? ''}
                              onChange={(event) => {
                                const mapping = structuredClone(draft.mapping!)
                                mapping[table].columns[field] =
                                  event.target.value === '' ? null : Number(event.target.value)
                                revise({ ...draft, mapping })
                              }}
                            >
                              <option value="">{t('spreadsheet', 'choose')}</option>
                              {headers(draft.book!.sheets[draft.mapping![table].sheet!]).map(
                                (header, index) => (
                                  <option key={index} value={index}>
                                    {columnLetter(index)} · {header}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        ))}
                      </>
                    )}
                  </fieldset>
                ))}
              </div>
            )}
            {draft.book && <WorkbookPreview book={draft.book} />}
            {review.issues.length > 0 && (
              <section aria-label={t('spreadsheet', 'corrections')}>
                <h3>{t('spreadsheet', 'corrections')}</h3>
                {review.issues.map((issue, index) => (
                  <div
                    className="import-issue"
                    key={`${sourceVersion}-${issue.table}-${issue.row}-${issue.field}-${issue.code}`}
                  >
                    <p id={`maintenance-issue-${index}`}>
                      {issue.table}
                      {issue.row === undefined ? '' : ` · ${review.rows[issue.table][issue.row]}`}
                      {issue.field ? ` · ${issue.field}` : ''} — {t('maintenance', issue.code)}
                    </p>
                    {issue.row !== undefined && issue.field && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          correct(
                            issue.table,
                            issue.row!,
                            issue.field!,
                            (event.currentTarget.elements.namedItem('value') as HTMLInputElement)
                              .value,
                          )
                        }}
                      >
                        <label>
                          {issue.field}
                          <input
                            name="value"
                            aria-invalid="true"
                            aria-describedby={`maintenance-issue-${index}`}
                            defaultValue={String(
                              review.records[issue.table][issue.row][issue.field] ?? '',
                            )}
                          />
                        </label>
                        <button className="text-button" type="submit">
                          {t('spreadsheet', 'correct')}
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </section>
            )}
            {tables.map((table) => (
              <details className="advanced-panel" key={table}>
                <summary>
                  {table} ({review.records[table].length})
                </summary>
                <div className="work-table-scroll" role="region" aria-label={table} tabIndex={0}>
                  <table className="import-preview">
                    <thead>
                      <tr>
                        <th scope="col">{t('maintenance', 'sourceRecord')}</th>
                        {fields(table).map((field) => (
                          <th scope="col" key={field} lang="">
                            {field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {review.records[table].map((row, index) => (
                        <tr key={index}>
                          <th scope="row">{review.rows[table][index]}</th>
                          {fields(table).map((field) => (
                            <td key={field}>{String(row[field] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
            <label className="attention-filter">
              <input
                type="checkbox"
                data-confirm
                checked={confirmed}
                disabled={review.issues.length > 0}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {t('maintenance', 'confirm')}
            </label>
            {confirmed && !review.issues.length && (
              <a
                className="text-button maintenance-export"
                download="maintenance-shift-inputs.json"
                href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(review.records, null, 2))}`}
              >
                {t('maintenance', 'export')}
              </a>
            )}
          </fieldset>
        )}
        <p className="muted" id="maintenance-run-status">
          {t('maintenance', 'unavailable')}
        </p>
        <button
          className="primary-button"
          type="button"
          disabled
          aria-describedby="maintenance-run-status"
        >
          {t('maintenance', 'run')}
        </button>
      </div>
    </section>
  )
}
