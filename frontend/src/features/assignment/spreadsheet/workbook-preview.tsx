import { useState } from 'react'
import { useLocale } from '../../../shared/i18n/locale-context'
import { columnLetter } from './column-letter'
import { headers, type Workbook } from './workbook'
export function WorkbookPreview({ book }: { book: Workbook }) {
  const { t } = useLocale()
  const [all, setAll] = useState(false)
  return <details className="advanced-panel"><summary>{t('spreadsheet', 'preview')}</summary>
    <label className="attention-filter"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} />{t('spreadsheet', 'showAll')}</label>
    {book.sheets.map((sheet, index) => <div key={index} className="work-table-scroll" role="region" aria-label={sheet.name} tabIndex={0}>
      <table className="import-preview"><caption>{sheet.name}</caption><thead><tr><th scope="col">{t('spreadsheet', 'row')}</th>
        {headers(sheet).map((name, column) => <th scope="col" key={column}>{columnLetter(column)} · {name || '—'}</th>)}
      </tr></thead><tbody>{sheet.sourceRows.map((cells, i) => ({ cells, row: i + 1 })).slice(0, all ? undefined : 10).map(({ cells, row }) => <tr key={row}>
        <th scope="row">{row}</th>{cells.map((value, column) => <td key={column}>{value}</td>)}
      </tr>)}</tbody></table>
    </div>)}
  </details>
}
