import { useLocale } from '../../../shared/i18n/locale-context'
import { columnLetter } from './column-letter'
import { fields, suggestFields } from './mapping'
import type { SheetSelection } from './sheet-selection'
import { headers, sourceRows, type Workbook } from './workbook'
export function MappingEditor({ book, mapping, onChange, onHeading }: {
  book: Workbook; mapping: SheetSelection; onChange: (mapping: SheetSelection) => void; onHeading: (sheet: number, row: number) => void
}) {
  const { t } = useLocale()
  return <div className="import-mapping">{(['jobs', 'people'] as const).map(group => {
    const selected = mapping[group] as unknown as Record<string, number | null>
    const sheet = selected.sheet === null ? undefined : book.sheets[selected.sheet]
    return <fieldset key={group}><legend>{t('spreadsheet', group)}</legend>
      <label>{t('spreadsheet', 'sheet')}<select value={selected.sheet ?? ''} onChange={event => {
        const index = event.target.value === '' ? null : Number(event.target.value)
        onChange({ ...mapping, [group]: { sheet: index, ...suggestFields(group, index === null ? [] : headers(book.sheets[index])) } })
      }}><option value="">{t('spreadsheet', 'choose')}</option>{book.sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select></label>
      {sheet && <>
        <label>{t('spreadsheet', 'headingRow')}<select value={sheet.headingRow} onChange={event => onHeading(selected.sheet!, Number(event.target.value))}>
          {sheet.sourceRows.slice(0, 4).map((row, i) => <option key={i} value={i + 1}>{i + 1} · {row.join(' · ').slice(0, 120)}</option>)}
        </select></label>
        {sheet.headingRow > 1 && <p>{t('spreadsheet', 'skipped', { count: String(sheet.headingRow - 1) })}</p>}
        {fields[group].map(field => <label key={field}>{t('spreadsheet', field)}<select value={selected[field] ?? ''}
          onChange={event => onChange({ ...mapping, [group]: { ...selected, [field]: event.target.value === '' ? null : Number(event.target.value) } })}>
          <option value="">{t('spreadsheet', 'choose')}</option>
          {headers(sheet).map((name, i) => <option key={i} value={i}>{columnLetter(i)} · {name || '—'} · {(sourceRows(sheet)[0]?.cells[i] ?? '').slice(0, 64)}</option>)}
        </select></label>)}
      </>}
    </fieldset>
  })}</div>
}
