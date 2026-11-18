import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import type { SolveResult } from '../../shared/api/solve'
import { WorkbenchHeader } from '../../shared/workbench/workbench-header'
import { useLocale } from '../../shared/i18n/locale-context'
import { useTheme } from '../../shared/theme/use-theme'
import { PlanResult } from '../assignment/plan-result'
import { recipeDetailApi } from './detail/recipe-detail-api'
import './recipe-detail.css'

const detailRoute = getRouteApi('/recipes/$recipeId')

export function RecipeDetailPage() {
  const { recipeId } = detailRoute.useParams()
  return <RecipeWorkbench key={recipeId} recipeId={recipeId} />
}

function RecipeWorkbench({ recipeId }: { recipeId: string }) {
  const { theme } = useTheme()
  const { t } = useLocale()
  const heading = useRef<HTMLHeadingElement>(null)
  const activeRun = useRef<AbortController | null>(null)
  const [lastResult, setLastResult] = useState<SolveResult>()
  const preview = useQuery({
    queryKey: ['recipe-preview', recipeId],
    queryFn: ({ signal }) => recipeDetailApi.preview(recipeId, signal),
    retry: false,
  })
  const run = useMutation({
    mutationFn: (signal: AbortSignal) => recipeDetailApi.run(recipeId, signal),
    retry: false,
  })

  useEffect(() => {
    heading.current?.focus()
    return () => {
      const controller = activeRun.current
      activeRun.current = null
      controller?.abort()
    }
  }, [])

  async function runExample() {
    if (!preview.isSuccess || activeRun.current) return
    const controller = new AbortController()
    activeRun.current = controller
    try {
      const checkedResult = await run.mutateAsync(controller.signal)
      if (activeRun.current === controller && !controller.signal.aborted) setLastResult(checkedResult)
    } catch {
      // PlanResult presents the decoded API failure.
    } finally {
      if (activeRun.current === controller) activeRun.current = null
    }
  }

  return (
    <div className="shell" data-theme={theme}>
      <WorkbenchHeader active="recipes" mainId="recipe-work" navigation={<>
        <Link to="/">{t('app-shell', 'assignment')}</Link>
        <Link to="/recipes" aria-current="page">{t('app-shell', 'recipes')}</Link>
      </>} />
      <main className="content recipe-workbench" id="recipe-work" tabIndex={-1}>
        <Link className="recipe-detail-link" to="/recipes">{t('recipe-grid', 'backToRecipes')}</Link>
        <div className="heading">
          <div>
            <h1 tabIndex={-1} ref={heading} lang={preview.data ? '' : undefined}>{preview.data?.metadata.title ?? t('recipe-grid', 'exampleHeading')}</h1>
            {preview.data && <p lang="">{preview.data.metadata.scenario}</p>}
          </div>
        </div>
        {preview.isPending && <p role="status">{t('recipe-grid', 'loadingExample')}</p>}
        {preview.isError && (
          <>
            <p role="alert">{t('recipe-grid', 'previewError')}</p>
            <button className="primary-button" type="button" disabled={preview.isFetching}
              onClick={() => void preview.refetch()}>{t('grid', 'retry')}</button>
          </>
        )}
        {preview.data && (
          <div className="workspace-grid">
            <section className="panel" aria-labelledby="recipe-preview-heading">
              <div className="panel-header"><h2 id="recipe-preview-heading">{t('recipe-grid', 'exampleHeading')}</h2></div>
              <div className="recipe-preview">
                <p>{t('recipe-grid', 'exampleSafety')}</p>
                <h3>{t('recipe-grid', 'inputFields')}</h3>
                <dl className="assignment-list" lang="">
                  {preview.data.metadata.inputs.map(field => (
                    <div key={field.name}><dt>{field.name}</dt><dd>{field.description}</dd></div>
                  ))}
                </dl>
                <details className="advanced-panel">
                  <summary>{t('recipe-grid', 'exampleJson')}</summary>
                  <pre className="result-json" tabIndex={0} aria-label={t('recipe-grid', 'exampleJson')}>{preview.data.exactExampleJson}</pre>
                </details>
              </div>
              <div className="panel-footer setup-footer">
                <button className="primary-button" type="button" onClick={() => void runExample()} disabled={run.isPending}>
                  {run.isPending ? t('app', 'checking') : t('app', 'runExample')}
                </button>
                {!run.isIdle && <a className="text-button result-jump" href="#recipe-plan-heading">{t('plan-result', 'goToReview')}</a>}
              </div>
            </section>
            <PlanResult pending={run.isPending} error={run.error} result={lastResult} example={false} edited={false} headingId="recipe-plan-heading" retainPrevious />
          </div>
        )}
      </main>
    </div>
  )
}
