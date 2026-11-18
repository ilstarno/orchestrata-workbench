import { useLayoutEffect, useRef, useState } from 'react'
import { useLocale } from '../../../shared/i18n/locale-context'
import { SolveError } from '../../../shared/api/solve'
import type { ImportFeedback } from './import-feedback'
import { columnLetter } from './column-letter'
import { checkMapping, suggestMapping, suggestFields } from './mapping'
import { importedCsv, runImportedAssignment, type ImportedPlan } from './compile-assignment'
import { MappingEditor } from './mapping-editor'
import { WorkbookPreview } from './workbook-preview'
import { restoreMapping, saveMapping } from './saved-mapping'
import type { SheetSelection } from './sheet-selection'
import { headers, ImportError, sourceRows, type Workbook } from './workbook'
import './spreadsheet.css'

export function SpreadsheetPlan() {
  const { t } = useLocale()
  const reviewElement = useRef<HTMLFieldSetElement>(null)
  const focusCorrection = useRef(false)
  useLayoutEffect(() => {
    if (!focusCorrection.current) return
    focusCorrection.current = false
    reviewElement.current?.querySelector<HTMLElement>('input[aria-invalid=true], input[data-confirm]')?.focus()
  })
  const [csv, setCsv] = useState(false)
  const [files, setFiles] = useState<(File | undefined)[]>([])
  const [draft, setDraft] = useState<{ book: Workbook; mapping: SheetSelection; revision: number; filenames: string }>()
  const [sourceVersion, setSourceVersion] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ImportFeedback>()
  const [note, setNote] = useState<'mappingSaved' | 'mappingNotSaved'>()
  const [last, setLast] = useState<{ plan: ImportedPlan; revision: number; filenames: string; jobsSheet: string; peopleSheet: string }>()
  const active = useRef(false)
  const revision = useRef(0)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const checked = draft && checkMapping(draft.book, draft.mapping)
  const pendingChanges = last && (last.revision !== draft?.revision || !!error || busy)

  function revise(book: Workbook, mapping: SheetSelection, filenames = draft?.filenames ?? '') {
    setDraft({ book, mapping, revision: ++revision.current, filenames }); setConfirmed(false); setNote(undefined); setError(undefined)
  }
  async function open() {
    if (active.current) return
    const selected = files.filter((file): file is File => !!file)
    if (selected.length !== (csv ? 2 : 1)) return
    active.current = true; setBusy(true); setError(undefined); setNote(undefined)
    try {
      if (selected.some(file => !(csv ? /\.csv$/i : /\.xlsx$/i).test(file.name))) throw new ImportError('unsupported-file')
      const { readWorkbook } = await import('./file-reader')
      const books = await Promise.all(selected.map(readWorkbook))
      const book = { sheets: books.flatMap(item => item.sheets) }
      const mapping = restoreMapping(book, suggestMapping(book, csv))
      revise(book, mapping, selected.map(file => file.name).join(' · ')); setSourceVersion(current => current + 1)
    } catch (cause) {
      setError({ component: 'spreadsheet', key: cause instanceof ImportError ? cause.code : 'invalid-file' })
    } finally {
      setFiles([]); for (const input of inputs.current) if (input) input.value = ''
      active.current = false; setBusy(false)
    }
  }
  async function run() {
    if (active.current || !confirmed || !draft || !checked?.input) return
    active.current = true; setBusy(true); setError(undefined)
    const snapshot = draft
    try {
      const plan = await runImportedAssignment(checked.input, sourceRows(draft.book.sheets[draft.mapping.jobs.sheet!]).map(row => row.row), sourceRows(draft.book.sheets[draft.mapping.people.sheet!]).map(row => row.row))
      setLast({ plan, revision: snapshot.revision, filenames: snapshot.filenames, jobsSheet: snapshot.book.sheets[snapshot.mapping.jobs.sheet!].name, peopleSheet: snapshot.book.sheets[snapshot.mapping.people.sheet!].name })
    } catch (cause) {
      const kind = cause instanceof SolveError ? cause.kind : 'execution'
      const message = kind === 'search-limit' ? 'limitDetail' : kind === 'access-denied' ? 'accessDetail' : kind === 'offline' ? 'offlineDetail' : kind === 'busy' ? 'busyDetail' : 'executionDetail'
      setError({ component: 'plan-result', key: message })
    } finally { active.current = false; setBusy(false) }
  }
  const download = last && importedCsv(last.plan, [t('spreadsheet', 'row'), t('spreadsheet', 'job'), t('spreadsheet', 'person'), t('spreadsheet', 'personRow')])
  return <section className="panel spreadsheet-workbench" aria-labelledby="spreadsheet-heading">
    <div className="panel-header"><h2 id="spreadsheet-heading">{t('spreadsheet', 'title')}</h2></div>
    <div className="import-content">
      <p>{t('spreadsheet', 'intro')}</p><p className="muted">{t('spreadsheet', 'limits')}</p>
      <fieldset disabled={busy} className="import-upload"><legend className="sr-only">{t('spreadsheet', 'title')}</legend>
        <label className="attention-filter"><input type="checkbox" checked={csv} onChange={event => { setCsv(event.target.checked); setFiles([]) }} />{t('spreadsheet', 'csvMode')}</label>
        {(csv ? ['jobsFile', 'peopleFile'] as const : ['workbook'] as const).map((label, index) => <label key={label}>{t('spreadsheet', label)}
          <input ref={node => { inputs.current[index] = node }} type="file" accept={csv ? '.csv,text/csv' : '.xlsx'}
            onChange={event => { const selected = event.target.files?.[0]; setFiles(current => { const next = [...current]; next[index] = selected; return next }) }} />
        </label>)}
        <button className="primary-button" type="button" disabled={files.filter(Boolean).length !== (csv ? 2 : 1)} onClick={() => void open()}>{t('spreadsheet', 'open')}</button>
      </fieldset>
      {draft && <fieldset disabled={busy} className="import-review" ref={reviewElement}><legend>{t('spreadsheet', 'mapping')}</legend>
        <p>{draft.filenames}</p>
        <MappingEditor book={draft.book} mapping={draft.mapping} onChange={mapping => revise(draft.book, mapping)} onHeading={(sheet, row) => {
          const book = structuredClone(draft.book); book.sheets[sheet].headingRow = row
          const mapping = structuredClone(draft.mapping)
          for (const group of ['jobs', 'people'] as const) if (mapping[group].sheet === sheet) Object.assign(mapping[group], suggestFields(group, headers(book.sheets[sheet])))
          revise(book, mapping)
        }} />
        <WorkbookPreview book={draft.book} />
        {!!checked?.issues.length && <section aria-label={t('spreadsheet', 'corrections')}><h3>{t('spreadsheet', 'corrections')}</h3>
          {checked.issues.map(issue => <div className="import-issue" key={`${sourceVersion}-${issue.group}-${issue.sheet}-${issue.row}-${issue.column}-${issue.field}-${issue.code}`}>
            <p id={`issue-${issue.group}-${issue.sheet}-${issue.row}-${issue.column}-${issue.field}-${issue.code}`}>{t('spreadsheet', issue.group)}{issue.sheet === undefined ? '' : ` · ${draft.book.sheets[issue.sheet].name}`}
              {issue.row === undefined ? '' : ` · ${t('spreadsheet', 'row')} ${issue.row}`}{issue.column === undefined ? '' : ` · ${columnLetter(issue.column)}`} — {t('spreadsheet', `issue_${issue.code}`)}</p>
            {issue.sheet !== undefined && issue.row !== undefined && issue.column !== undefined && <form onSubmit={event => {
              event.preventDefault()
              const value = (event.currentTarget.elements.namedItem('value') as HTMLInputElement).value
              focusCorrection.current = true
              const book = structuredClone(draft.book)
              book.sheets[issue.sheet!].sourceRows[issue.row! - 1][issue.column!] = value
              revise(book, draft.mapping)
            }}><label>{t('spreadsheet', issue.field ?? 'name')} · {columnLetter(issue.column)}{issue.row}
              <input name="value" aria-invalid="true" aria-describedby={`issue-${issue.group}-${issue.sheet}-${issue.row}-${issue.column}-${issue.field}-${issue.code}`} defaultValue={draft.book.sheets[issue.sheet].sourceRows[issue.row - 1][issue.column]} />
            </label><button type="submit" className="text-button">{t('spreadsheet', 'correct')}</button></form>}
          </div>)}
        </section>}
        <label className="attention-filter"><input type="checkbox" data-confirm checked={confirmed} disabled={!checked?.input} onChange={event => setConfirmed(event.target.checked)} />{t('spreadsheet', 'confirm')}</label>
        <div className="import-actions"><button type="button" className="text-button" disabled={!confirmed} onClick={() => setNote(saveMapping(draft.book, draft.mapping) ? 'mappingSaved' : 'mappingNotSaved')}>{t('spreadsheet', 'saveMapping')}</button>
          <button type="button" className="primary-button" disabled={!confirmed || !checked?.input} onClick={() => void run()}>{t('spreadsheet', 'run')}</button>{last && <a className="text-button" href="#import-result-heading">{t('spreadsheet', 'reviewResult')}</a>}</div>
      </fieldset>}
      <p role="status">{busy ? t('spreadsheet', 'checking') : (note ? t('spreadsheet', note) : '') || (checked?.input ? t('spreadsheet', 'ready', { jobs: String(checked.input.jobs.length), people: String(checked.input.people.length) }) : '')}</p>
      {error && <p className="error" role="alert">{error.component === 'spreadsheet' ? t('spreadsheet', error.key) : t('plan-result', error.key)}</p>}
      {last && <section aria-labelledby="import-result-heading"><h3 id="import-result-heading" tabIndex={-1}>{t('spreadsheet', pendingChanges ? 'previous' : 'result')}</h3>
        <div className="plan-input-context" aria-label={t('spreadsheet', 'planSource')}>
          <h4>{t('spreadsheet', 'planSource')}</h4><p>{last.filenames}</p>
          <p>{t('spreadsheet', 'jobsSheet', { sheet: last.jobsSheet })} · {t('spreadsheet', 'peopleSheet', { sheet: last.peopleSheet })}</p>
        </div>
        <p role="status">{t('spreadsheet', 'planCounts', { assigned: String(last.plan.rows.filter(row => row.person !== null).length), unassigned: String(last.plan.rows.filter(row => row.person === null).length) })}</p>
        <a className="text-button export-import" download="spreadsheet-plan.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(download!)}`}>{t('plan-result', 'downloadPlan')}</a>
        <div className="work-table-scroll" role="region" aria-label={t('spreadsheet', 'result')} tabIndex={0}>
          <table className="work-table"><thead><tr><th scope="col">{t('spreadsheet', 'row')}</th><th scope="col">{t('spreadsheet', 'job')}</th><th scope="col">{t('spreadsheet', 'person')}</th></tr></thead>
            <tbody>{last.plan.rows.map((row, index) => <tr key={index}><td>{row.sourceRow}</td><th scope="row">{row.job}</th><td>{row.person ?? t('spreadsheet', 'unassigned')}{row.personRow !== null && <span className="source-detail"> · {t('spreadsheet', 'row')} {row.personRow}</span>}</td></tr>)}</tbody></table>
        </div>
      </section>}
    </div>
  </section>
}
