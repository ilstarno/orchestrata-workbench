import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../../frontend/src/app'
import { PlanResult } from '../../frontend/src/features/assignment/plan-result'
import { solveProblem, type SolveFailure, type SolveErrorCode, SolveError } from '../../frontend/src/shared/api/solve'
import { GridTable } from '../../frontend/src/features/grid/grid-table'
import { LocaleProvider } from '../../frontend/src/shared/i18n/locale-context'
import { type MessageKey, translate } from '../../frontend/src/shared/i18n/messages'
import { supportedLocales } from '../../frontend/src/shared/i18n/supported-locales'

describe('product localization', () => {
  it('localizes the app shell with an accessible selector for all supported languages', () => {
    const client = new QueryClient()
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <LocaleProvider initialLocale="de-DE"><App /></LocaleProvider>
      </QueryClientProvider>,
    )
    expect(markup).toContain(translate('de-DE', 'app', 'heading'))
    expect(markup).not.toContain(translate('en-US', 'app', 'heading'))
    expect(markup).toContain(translate('de-DE', 'language', 'label'))
    expect(markup).toMatch(/<label[^>]*for=/)
    expect(markup).toMatch(/<option value="de-DE" lang="de-DE" selected/)
    for (const locale of supportedLocales) expect(markup).toContain(`lang="${locale}"`)
    client.clear()
  })

  it('localizes the grid empty state without translating a server column or value', () => {
    const data = {
      columns: [{ id: 'title', label: 'Server label', sortable: false }],
      rows: [{ id: 'abc', cells: { title: 'Recipe supplied by server' } }],
      page: 1, pageSize: 25, totalItems: 1,
    }
    const grid = (rows: typeof data.rows) => renderToStaticMarkup(
      <LocaleProvider initialLocale="fr-FR">
        <GridTable title={translate('fr-FR', 'recipe-grid', 'gridLabel')}
          data={{ ...data, rows }} sorting={[]} onSortingChange={() => undefined} />
      </LocaleProvider>,
    )
    expect(grid(data.rows)).toContain('Server label')
    expect(grid(data.rows)).toContain('<td lang="">Recipe supplied by server</td>')
    expect(grid(data.rows)).toContain('<caption')
    expect(grid(data.rows)).toContain('tabindex="0"')
    expect(grid([])).toContain(translate('fr-FR', 'grid', 'noResults'))
    expect(grid([])).not.toContain(translate('en-US', 'grid', 'noResults'))
  })

  it('localizes the assignment error without exposing raw service diagnostics', () => {
    const error = new SolveError('search-limit')
    const markup = renderToStaticMarkup(
      <LocaleProvider initialLocale="it-IT">
        <PlanResult pending={false} error={error} example={false} edited={false} />
      </LocaleProvider>,
    )
    expect(markup).toContain('role="alert"')
    expect(markup).toContain(translate('it-IT', 'plan-result', 'limitTitle'))
    expect(markup).not.toContain(translate('en-US', 'plan-result', 'limitTitle'))
  })

  it.each([
    ['invalid-input', 'invalid_request_body', 'requestFormatTitle'],
    ['invalid-input', 'invalid_problem', 'problemTitle'],
    ['unexpected-response', 'not_found', 'endpointTitle'],
    ['unexpected-response', 'method_not_allowed', 'endpointTitle'],
    ['unexpected-response', 'request_rejected', 'rejectedTitle'],
    ['search-limit', 'search_limit_exceeded', 'limitTitle'],
    ['busy', 'solver_busy', 'busyTitle'],
    ['execution', 'solve_execution_failed', 'executionTitle'],
    ['execution', 'internal_error', 'executionTitle'],
  ] as const satisfies readonly (readonly [SolveFailure, SolveErrorCode, MessageKey<'plan-result'>])[])(
    'shows actionable localized guidance and only the known support code for %s / %s',
    (kind, code, expected) => {
      for (const locale of supportedLocales) {
        const markup = renderToStaticMarkup(
          <LocaleProvider initialLocale={locale}>
            <PlanResult pending={false} error={new SolveError(kind, code)} example={true} edited={false} />
          </LocaleProvider>,
        )
        expect(markup).toContain('<h3>' + translate(locale, 'plan-result', expected) + '</h3>')
        expect(markup).toContain(translate(locale, 'plan-result', 'serviceCode'))
        expect(markup).toContain('<code lang="">' + code + '</code>')
        expect(markup).not.toContain(translate(locale, 'plan-result', 'infeasibleTitle'))
      }
    },
  )

  it('does not display unknown header values or raw backend messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Raw and untrusted', {
      status: 422,
      headers: { 'x-orchestrata-error-code': 'unknown-code' },
    })))
    let error: Error | null = null
    try {
      await solveProblem('{}')
    } catch (failure) {
      if (failure instanceof Error) error = failure
    } finally {
      vi.unstubAllGlobals()
    }
    expect(error).toBeInstanceOf(SolveError)
    const markup = renderToStaticMarkup(
      <LocaleProvider initialLocale="fr-FR">
        <PlanResult pending={false} error={error} example={false} edited={false} />
      </LocaleProvider>,
    )
    expect(markup).toContain(translate('fr-FR', 'plan-result', 'responseTitle'))
    expect(markup).not.toContain('unknown-code')
    expect(markup).not.toContain('Raw and untrusted')
    expect(markup).not.toContain(translate('fr-FR', 'plan-result', 'serviceCode'))
  })

  it('interpolates localized page and count placeholders', () => {
    const formatted = new Intl.NumberFormat('pl-PL').format(1500)
    const label = translate('pl-PL', 'grid', 'resultCountMany', { count: formatted })
    expect(label).toContain(formatted)
    expect(label).not.toContain('{count}')
    expect(label).not.toBe(translate('en-US', 'grid', 'resultCountOther', { count: formatted }))
  })

})
