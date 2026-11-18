import { useId, useRef, useState } from 'react'
import { Checkbox } from 'react-aria-components'
import { Check } from 'lucide-react'
import { useLocale } from '../../shared/i18n/locale-context'
import { type Eligibility, exampleJobs, exampleTechnicians } from '../../shared/examples/assignment'

interface ExampleOverviewProps {
  eligibility: Eligibility
  onChange: (job: number, technician: number, eligible: boolean) => void
}

export function ExampleOverview({ eligibility, onChange }: ExampleOverviewProps) {
  const { locale, t } = useLocale()
  const [selectedJob, setSelectedJob] = useState(0)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const editor = useRef<HTMLDetailsElement>(null)
  const selector = useRef<HTMLSelectElement>(null)
  const editorId = useId()
  const selectedDomain = eligibility[selectedJob]
  const technicianList = new Intl.ListFormat(locale, { style: 'long', type: 'disjunction' })
  const attentionCount = eligibility.filter(domain => domain.length === 0).length

  function editJob(job: number) {
    setSelectedJob(job)
    if (editor.current) editor.current.open = true
    selector.current?.focus()
  }

  return (
    <div className="example-overview">
      <p>{t('example-overview', 'scenario')}</p>
      <label className="attention-filter">
        <input type="checkbox" checked={attentionOnly} onChange={event => setAttentionOnly(event.target.checked)} />
        {t('example-overview', 'attentionOnly', { count: String(attentionCount) })}
      </label>
      <div className="work-table-scroll" role="region" aria-label={t('example-overview', 'jobs')} tabIndex={0}>
        <table className="work-table">
          <caption className="sr-only">{t('example-overview', 'jobs')}</caption>
          <thead><tr>
            <th scope="col">{t('example-overview', 'job')}</th>
            <th scope="col">{t('example-overview', 'eligiblePeople')}</th>
            <th scope="col"><span className="sr-only">{t('example-overview', 'actions')}</span></th>
          </tr></thead>
          <tbody>{eligibility.map((domain, index) => (!attentionOnly || !domain.length) && (
            <tr key={exampleJobs[index]}>
              <th scope="row">{exampleJobs[index]}</th>
              <td>{domain.length ? technicianList.format(domain.map(id => exampleTechnicians.get(id) ?? String(id)))
                : <span className="error">{t('example-overview', 'nobody')}</span>}</td>
              <td><button className="text-button" type="button" aria-controls={editorId}
                aria-label={t('example-overview', 'editJob', { job: exampleJobs[index] })}
                onClick={() => editJob(index)}>{t('example-overview', 'edit')}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {attentionOnly && !attentionCount && <p role="status">{t('example-overview', 'noAttention')}</p>}
      <p className="rule-note"><strong>{t('example-overview', 'preferenceLabel')}</strong> {t('example-overview', 'preference')}</p>
      <details className="advanced-panel eligibility-editor" ref={editor} id={editorId}>
        <summary>{t('example-overview', 'editEligibility')}</summary>
        <p>{t('example-overview', 'eligibilityHelp')}</p>
        <label className="eligibility-selector">
          <span>{t('example-overview', 'jobToEdit')}</span>
          <select ref={selector} value={selectedJob} onChange={event => {
            const index = event.currentTarget.selectedIndex
            if (index >= 0 && index < eligibility.length) setSelectedJob(index)
          }}>
            {exampleJobs.map((title, job) => <option key={title} value={job}>{title}</option>)}
          </select>
        </label>
        <fieldset className="eligibility-group" aria-describedby={!selectedDomain.length ? `${editorId}-issue` : undefined}>
          <legend>{exampleJobs[selectedJob]}</legend>
          {[...exampleTechnicians].map(([id, name]) => (
            <Checkbox className="eligibility-option" key={id} isSelected={selectedDomain.includes(id)}
              onChange={selected => onChange(selectedJob, id, selected)}>
              <span className="eligibility-check" aria-hidden="true"><Check size={14} /></span>{name}
            </Checkbox>
          ))}
        </fieldset>
        {!selectedDomain.length && <p className="error" id={`${editorId}-issue`}>{t('example-overview', 'selectPerson')}</p>}
      </details>
    </div>
  )
}
