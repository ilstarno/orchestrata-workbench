import { planCsv } from './plan-export'
import { Braces, Check, ClipboardList } from 'lucide-react'
import { type SolveErrorCode, type SolveResult, SolveError } from '../../shared/api/solve'
import { useLocale } from '../../shared/i18n/locale-context'
import type { MessageKey } from '../../shared/i18n/messages'
import { exampleJobs, exampleTechnicians } from '../../shared/examples/assignment'

const failureKeys = {
  'access-denied': ['accessTitle', 'accessDetail'],
  'invalid-input': ['invalidTitle', 'invalidDetail'],
  'search-limit': ['limitTitle', 'limitDetail'],
  'ambiguous-request': ['ambiguousTitle', 'ambiguousDetail'],
  busy: ['busyTitle', 'busyDetail'],
  offline: ['offlineTitle', 'offlineDetail'],
  execution: ['executionTitle', 'executionDetail'],
  'unexpected-response': ['responseTitle', 'responseDetail'],
} as const

type FailureMessage = readonly [MessageKey<'plan-result'>, MessageKey<'plan-result'>]

const indexedFailureKeys: Partial<Record<SolveErrorCode, FailureMessage>> = {
  invalid_request_body: ['requestFormatTitle', 'requestFormatDetail'],
  invalid_problem: ['problemTitle', 'problemDetail'],
  not_found: ['endpointTitle', 'endpointDetail'],
  method_not_allowed: ['endpointTitle', 'endpointDetail'],
  request_rejected: ['rejectedTitle', 'rejectedDetail'],
}

interface PlanResultProps {
  pending: boolean
  result?: SolveResult
  error: Error | null
  example: boolean
  edited: boolean
  headingId?: string
  failureExample?: boolean
  failureEdited?: boolean
  retainPrevious?: boolean
}

function getStatusKey(pending: boolean, result: SolveResult | undefined, error: Error | null, edited: boolean, failureEdited: boolean): MessageKey<'plan-result'> {
  if (pending) return 'checking'
  if (error) return failureEdited ? 'previousRun' : 'notCompleted'
  if (edited && result) return 'previousRun'
  if (result?.kind === 'infeasible') return 'noPlan'
  if (result) return 'planReady'
  return 'notStarted'
}

export function PlanResult({
  pending, result, error, example, edited, headingId = 'plan-heading',
  failureExample = example, failureEdited = edited, retainPrevious = false,
}: PlanResultProps) {
  const { t } = useLocale()
  const status = t('plan-result', getStatusKey(pending, result, error, edited, failureEdited))
  const csv = result && planCsv(result, example, [t('plan-result', 'exportDecision'), t('plan-result', 'exportAssignment')])
  const showPrevious = result && retainPrevious && (pending || error)
  return (
    <section className="panel result-panel" aria-labelledby={headingId}>
      <div className="panel-header">
        <div><span className="panel-kicker">{t('plan-result', 'review')}</span><h2 id={headingId} tabIndex={-1}>{t('plan-result', 'title')}</h2></div>
        <span className="result-status">{status}</span>
      </div>
      <div className="sr-only" role="status">{status}</div>
      <div className="result-content" aria-busy={pending}>
        {pending && !showPrevious && <EmptyPlan title={t('plan-result', 'finding')} text={t('plan-result', 'findingDetail')} />}
        {!pending && error && <Failure error={error} example={failureExample} edited={failureEdited} />}
        {(showPrevious || (!pending && result)) && result && (
          <div className="plan">
            {showPrevious
              ? <h3>{t('plan-result', result.kind === 'solved' ? 'lastSuccessfulPlan' : 'previousRun')}</h3>
              : edited && <p className="rule-note">{t('plan-result', 'staleResult')}</p>}
            <Result result={result} example={example} />
            {csv && <a className="text-button export-plan" download="assignment-plan.csv"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}>{t('plan-result', 'downloadPlan')}</a>}
          </div>
        )}
        {!pending && !error && !result && (
          <EmptyPlan title={t('plan-result', 'noPlanYet')} text={t('plan-result', 'noPlanDetail')} />
        )}
      </div>
      <div className="panel-footer muted">{t('plan-result', 'noScheduleChange')}</div>
    </section>
  )
}

function EmptyPlan({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><ClipboardList size={27} strokeWidth={1.5} aria-hidden /></div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function Failure({ error, example, edited }: { error: Error; example: boolean; edited: boolean }) {
  const { t } = useLocale()
  const indexed = error instanceof SolveError ? error : undefined
  const kind = indexed?.kind ?? 'execution'
  const code = indexed?.code
  const codeMessage = code ? indexedFailureKeys[code] : undefined
  const [title, text] = codeMessage ?? failureKeys[kind]
  const detail = !codeMessage && kind === 'invalid-input' && example
    ? 'invalidExampleDetail'
    : text

  return (
    <div className="plan plan-error" role="alert">
      {edited && <p className="rule-note">{t('plan-result', 'staleMessage')}</p>}
      <h3>{t('plan-result', title)}</h3>
      <p>{t('plan-result', detail)}</p>
      {code && <details className="advanced-panel">
        <summary><Braces size={16} aria-hidden /> {t('plan-result', 'technical')}</summary>
        <dl className="assignment-list">
          <div><dt>{t('plan-result', 'serviceCode')}</dt><dd><code lang="">{code}</code></dd></div>
        </dl>
      </details>}
    </div>
  )
}

function Result({ result, example }: { result: SolveResult; example: boolean }) {
  const { locale, t } = useLocale()
  const formatNumber = new Intl.NumberFormat(locale)
  if (result.kind === 'infeasible') {
    return <><h3>{t('plan-result', 'infeasibleTitle')}</h3><p>{t('plan-result', 'infeasibleDetail')}</p></>
  }
  if (result.kind === 'exact-json') {
    return (
      <>
        <h3>{t('plan-result', 'found')}</h3>
        <p>{t('plan-result', 'largeNumbers')}</p>
        <pre className="result-json" tabIndex={0} aria-label={t('plan-result', 'exactJson')}>{result.json}</pre>
      </>
    )
  }

  const { values, score, evaluated } = result.assignment
  return (
    <>
      <h3 className="plan-success"><Check size={20} aria-hidden /> {t('plan-result', example ? 'allCovered' : 'found')}</h3>
      <p>{t('plan-result', 'rulesMet')}</p>
      <dl className="assignment-list">
        {values.map((value, index) => (
          <div key={index}>
            <dt>{(example && exampleJobs[index]) || t('plan-result', 'decision', { index: formatNumber.format(index + 1) })}</dt>
            <dd>{(example && exampleTechnicians.get(value)) || value}</dd>
          </div>
        ))}
      </dl>
      <details className="advanced-panel">
        <summary><Braces size={16} aria-hidden /> {t('plan-result', 'technical')}</summary>
        <dl className="assignment-list">
          <div><dt>{t('plan-result', 'hardScore')}</dt><dd>{score.hard}</dd></div>
          <div><dt>{t('plan-result', 'preferenceScore')}</dt><dd>{score.soft}</dd></div>
          <div><dt>{t('plan-result', 'checkedCount')}</dt><dd>{formatNumber.format(evaluated)}</dd></div>
        </dl>
      </details>
    </>
  )
}
