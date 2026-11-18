import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../../shared/i18n/locale-context'
import type { Records } from '../input-model'
import type { Objective } from './objective'
import type { LocalPlan } from './local-plan'
import { runLocal } from './run-local'
export function LocalRunPanel({
  records,
  confirmed,
  source,
  objective,
}: {
  records?: Records
  confirmed: boolean
  source: string
  objective: Objective
}) {
  const { t } = useLocale()
  const [last, setLast] = useState<{ key: string; plan: LocalPlan }>()
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed' | 'timeout'>(
    'idle',
  )
  const active = useRef<AbortController | null>(null)
  const key = JSON.stringify([records, source, objective, confirmed])
  const current = useRef(key)
  current.current = key
  useEffect(() => {
    active.current?.abort()
    active.current = null
    setStatus('idle')
    return () => {
      active.current?.abort()
      active.current = null
    }
  }, [key])
  async function run() {
    if (!records || !confirmed || active.current) return
    const controller = new AbortController()
    active.current = controller
    setStatus('running')
    try {
      const plan = await runLocal(
        { records: structuredClone(records), source, objective },
        controller.signal,
      )
      if (active.current === controller && current.current === key && !controller.signal.aborted) {
        setLast({ key, plan })
        setStatus('success')
      }
    } catch (error) {
      if (active.current === controller && current.current === key && !controller.signal.aborted)
        setStatus(error instanceof Error && error.message === 'timeout' ? 'timeout' : 'failed')
    } finally {
      if (active.current === controller) active.current = null
    }
  }
  const previous = last && (last.key !== key || status !== 'success')
  return (
    <section className="local-plan" aria-labelledby="local-plan-heading">
      <h2 id="local-plan-heading">{t('maintenance', 'localHeading')}</h2>
      <p id="maintenance-run-status">{t('maintenance', 'localDetail')}</p>
      <button
        className="primary-button"
        aria-describedby="maintenance-run-status"
        type="button"
        disabled={!records || !confirmed || status === 'running'}
        onClick={() => void run()}
      >
        {t('maintenance', status === 'running' ? 'localRunning' : 'localRun')}
      </button>
      {status === 'running' && (
        <button
          className="text-button"
          type="button"
          onClick={() => {
            active.current?.abort()
            active.current = null
            setStatus('idle')
          }}
        >
          {t('maintenance', 'localCancel')}
        </button>
      )}
      {(status === 'failed' || status === 'timeout') && (
        <p role="alert">
          {t('maintenance', status === 'timeout' ? 'localTimeout' : 'localFailed')}
        </p>
      )}
      {last && (
        <div aria-live="polite">
          <h3>{t('maintenance', previous ? 'localPrevious' : 'localResult')}</h3>
          <p>
            {last.plan.source} · {t('maintenance', last.plan.objective)} · {last.plan.assigned} /{' '}
            {last.plan.total} {t('maintenance', 'localAssigned')} · {last.plan.minimized_edge_sum}{' '}
            {t('maintenance', last.plan.objective === 'cost' ? 'localCents' : 'localMinutes')}
          </p>
          <div
            className="import-table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t('maintenance', 'localResult')}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('maintenance', 'localOrder')}</th>
                  <th scope="col">{t('maintenance', 'localTechnician')}</th>
                </tr>
              </thead>
              <tbody>
                {last.plan.assignments.map((row) => (
                  <tr key={row.item_id}>
                    <th scope="row">{row.item_id}</th>
                    <td>{row.resource_id ?? t('maintenance', 'localUnassigned')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a
            className="text-button"
            download={'maintenance-' + last.plan.objective + '-plan.csv'}
            href={'data:text/csv;charset=utf-8,' + encodeURIComponent(last.plan.csv)}
          >
            {t('maintenance', 'localExport')}
          </a>
        </div>
      )}
      <a href="/licenses/maintenance-engine/ATTRIBUTION" target="_blank" rel="noreferrer">
        {t('maintenance', 'localLicense')}
      </a>
    </section>
  )
}
