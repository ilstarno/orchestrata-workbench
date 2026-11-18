import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from '../../frontend/src/app'
import { PlanResult } from '../../frontend/src/features/assignment/plan-result'
import { SolveError, type SolveResult } from '../../frontend/src/shared/api/solve'

describe('assignment workspace', () => {
  it('starts with an understandable example and keeps JSON closed', () => {
    const page = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>,
    )

    expect(page).toContain('Assign jobs to the right people.')
    expect(page).toContain('Each person can do one job.')
    expect(page).toContain('Lift repair')
    expect(page).toContain('Run example')
    expect(page).toContain('Change who can take each job')
    expect(page).toContain('<legend>Lift repair</legend>')
    expect(page).toContain('Job to edit')
    expect(page).toContain('<option value="1">Safety inspection</option>')
    expect(page).not.toContain('<legend>Safety inspection</legend>')
    expect(page).toContain('<details class="advanced-panel eligibility-editor"')
    expect(page).toContain('<details class="advanced-panel setup-advanced">')
    expect(page).not.toContain('Run edited setup')
  })

  it('presents named assignments and labels stale results', () => {
    const page = renderToStaticMarkup(
      <PlanResult
        pending={false}
        result={{ kind: 'solved', assignment: { values: [8, 2, 3], score: { hard: 0, soft: 0 }, evaluated: 8 } }}
        error={null}
        example={true}
        edited={true}
      />,
    )

    expect(page).toContain('All three jobs covered')
    expect(page).toContain('This result is from the last run.')
    expect(page).toContain('Previous run')
    expect(page).not.toContain('Plan ready')
    expect(page).toContain('id="plan-heading" tabindex="-1"')
    expect(page).toContain('Lift repair</dt><dd>Alex')
    expect(page).toContain('Safety inspection</dt><dd>Sam')
    expect(page).toContain('Preventive maintenance</dt><dd>Noor')
  })

  it('shows the guided form a server rejection without guessing why it was rejected', () => {
    const page = renderToStaticMarkup(
      <PlanResult pending={false} error={new SolveError('invalid-input')} example={true} edited={true} />,
    )

    expect(page).toContain('This message is from the last run.')
    expect(page).toContain('Previous run')
    expect(page).not.toContain('Not completed')
    expect(page).toContain('Review who can take each job, or reset to the example.')
    expect(page).not.toContain('Check the JSON')
    expect(page).not.toContain('No assignment fits all the rules')
  })

  it('keeps a fresh result current, and reports an in-flight run as checking', () => {
    const result = { kind: 'infeasible' } as const
    const fresh = renderToStaticMarkup(
      <PlanResult pending={false} error={null} result={result} example={true} edited={false} />,
    )
    const pending = renderToStaticMarkup(
      <PlanResult pending={true} error={null} result={result} example={true} edited={true} />,
    )

    expect(fresh).toContain('class="result-status">No plan')
    expect(fresh).not.toContain('Previous run')
    expect(pending).toContain('class="result-status">Checking')
    expect(pending).not.toContain('Previous run')
    expect(pending).not.toContain('No assignment fits all the rules')
  })

  it('keeps the previous named plan while a retry is pending or fails', () => {
    const result: Extract<SolveResult, { kind: 'solved' }> = {
      kind: 'solved',
      assignment: { values: [8, 2, 3], score: { hard: 0, soft: 0 }, evaluated: 8 },
    }
    const pending = renderToStaticMarkup(
      <PlanResult pending={true} error={null} result={result} example={true} edited={true} retainPrevious />,
    )
    const failed = renderToStaticMarkup(
      <PlanResult pending={false} error={new SolveError('invalid-input')} result={result}
        example={true} edited={true} failureExample={false} failureEdited={false} retainPrevious />,
    )
    expect(pending).toContain('class="result-status">Checking')
    expect(failed).toContain('class="result-status">Not completed')
    for (const page of [pending, failed]) {
      expect(page).toContain('<h3>Last successful plan</h3>')
      expect(page).toContain('Lift repair</dt><dd>Alex')
      expect(page).not.toContain('class="result-status">Plan ready')
    }
    expect(failed).toContain('role="alert"')
    expect(failed).toContain('Check the JSON')
    expect(failed).not.toContain('Review who can take each job')
  })

  it('distinguishes an unchecked run from a proven infeasible plan', () => {
    const limited = renderToStaticMarkup(
      <PlanResult pending={false} error={new SolveError('search-limit')} example={false} edited={false} />,
    )
    const infeasible = renderToStaticMarkup(
      <PlanResult pending={false} error={null} result={{ kind: 'infeasible' }} example={false} edited={false} />,
    )

    expect(limited).toContain('role="alert"')
    expect(limited).toContain('Too many combinations')
    expect(limited).not.toContain('No assignment fits all the rules')
    expect(infeasible).toContain('No assignment fits all the rules')
    expect(infeasible).not.toContain('role="alert"')
  })
})
