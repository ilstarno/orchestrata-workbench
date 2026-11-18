import { lazy, Suspense, type ReactNode, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Label, TextArea, TextField } from 'react-aria-components'
import { ArrowRight, Braces } from 'lucide-react'
import { ExampleOverview } from './features/assignment/example-overview'
import { PlanResult } from './features/assignment/plan-result'
import { solveProblem, type SolveResult } from './shared/api/solve'
import {
  changeEligibility,
  exampleDefinition,
  exampleEligibility,
  serializeEligibility,
} from './shared/examples/assignment'
import { WorkbenchHeader } from './shared/workbench/workbench-header'
import { useLocale } from './shared/i18n/locale-context'
import { useTheme } from './shared/theme/use-theme'
import './styles.css'
import './features/assignment/assignment.css'

const SpreadsheetPlan = lazy(() => import('./features/assignment/spreadsheet/spreadsheet-plan').then(module => ({ default: module.SpreadsheetPlan })))
const MaintenanceWorkbench = lazy(() => import('./features/maintenance/maintenance-workbench').then(module => ({ default: module.MaintenanceWorkbench })))

interface RunInput {
  definition: string
  useExampleLabels: boolean
}

export function App({ recipeNavigation }: { recipeNavigation?: ReactNode }) {
  const { theme } = useTheme()
  const { t } = useLocale()
  const [workflow, setWorkflow] = useState('assignment')
  const [maintenanceVisited, setMaintenanceVisited] = useState(false)
  const activeRun = useRef(false)
  const [eligibility, setEligibility] = useState(exampleEligibility)
  const [customDefinition, setCustomDefinition] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<{ input: RunInput; result: SolveResult }>()
  const solve = useMutation({
    mutationFn: (input: RunInput) => solveProblem(input.definition),
  })
  const useExampleLabels = customDefinition === null
  const definition = customDefinition ?? serializeEligibility(eligibility)
  const originalExample = useExampleLabels && definition === exampleDefinition

  function differsFromCurrent(input: RunInput) {
    return input.definition !== definition || input.useExampleLabels !== useExampleLabels
  }

  function resetExample() {
    setEligibility(exampleEligibility)
    setCustomDefinition(null)
  }

  return (
    <div className="shell" data-theme={theme}>
      <WorkbenchHeader active="assignment" mainId="assignment-work" navigation={recipeNavigation} />

      <main className="content" id="assignment-work" tabIndex={-1}>
        <div className="eyebrow"><span className="signal" /> {t('app', 'workspace')}</div>
        <div className="heading">
          <div>
            <h1>{t('app', 'heading')}</h1>
            <p>{t('app', 'description')}</p>
          </div>
        </div>

        <label className="workflow-select">{t('maintenance', 'workflow')}
          <select value={workflow} onChange={event => { setWorkflow(event.target.value); if (event.target.value === 'maintenance') setMaintenanceVisited(true) }}>
            <option value="assignment">{t('maintenance', 'assignment')}</option><option value="maintenance">{t('maintenance', 'maintenance')}</option>
          </select>
        </label>
        {maintenanceVisited && <div hidden={workflow !== 'maintenance'}><Suspense fallback={<p role="status">{t('spreadsheet', 'checking')}</p>}><MaintenanceWorkbench /></Suspense></div>}
        <div hidden={workflow !== 'assignment'}>
        <Suspense fallback={<p role="status">{t('spreadsheet', 'checking')}</p>}><SpreadsheetPlan /></Suspense>
        <details className="sample-workflow"><summary>{t('spreadsheet', 'sample')}</summary>
        <div className="workspace-grid">
          <section className="panel" aria-labelledby="setup-heading">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">{t('app', 'setup')}</span>
                <h2 id="setup-heading">{useExampleLabels ? t('app', 'exampleHeading') : t('app', 'jsonSetupHeading')}</h2>
              </div>
            </div>

            {useExampleLabels ? (
              <ExampleOverview
                eligibility={eligibility}
                onChange={(job, technician, eligible) => {
                  setEligibility(current => changeEligibility(current, job, technician, eligible))
                }}
              />
            ) : <p className="custom-setup">{t('app', 'jsonSetupNote')}</p>}

            <details className="advanced-panel setup-advanced">
              <summary><Braces size={16} aria-hidden /> {t('app', 'editJson')}</summary>
              <TextField className="editor-field" value={definition} onChange={setCustomDefinition}>
                <Label className="sr-only">{t('app', 'problemJson')}</Label>
                <TextArea className="code-editor" spellCheck={false} />
              </TextField>
            </details>

            <div className="panel-footer setup-footer">
              {originalExample
                ? <span>{t('app', 'noSetup')}</span>
                : <Button className="text-button reset-button" onPress={resetExample}>{t('app', 'reset')}</Button>}
              <Button
                className="primary-button"
                isDisabled={solve.isPending}
                onPress={() => {
                  if (activeRun.current) return
                  activeRun.current = true
                  solve.mutate({ definition, useExampleLabels }, {
                    onSuccess: (result, input) => setLastRun({ input, result }),
                    onSettled: () => { activeRun.current = false },
                  })
                }}
              >
                {solve.isPending ? t('app', 'checking') : originalExample ? t('app', 'runExample') : t('app', 'runEdited')}
                <ArrowRight size={16} aria-hidden />
              </Button>
              {solve.variables !== undefined && (
                <a className="text-button result-jump" href="#plan-heading">
                  {t('plan-result', 'goToReview')}
                </a>
              )}
            </div>
          </section>

          <PlanResult
            pending={solve.isPending}
            result={lastRun?.result}
            error={solve.error}
            example={lastRun?.input.useExampleLabels ?? false}
            edited={lastRun !== undefined && differsFromCurrent(lastRun.input)}
            failureExample={solve.variables?.useExampleLabels ?? false}
            failureEdited={solve.variables !== undefined && differsFromCurrent(solve.variables)}
            retainPrevious
          />
        </div>
        </details>
        </div>
        <footer className="page-footer">
          {t('app', 'footerBrand')}
          <span>{t('app', 'footerWarning')}</span>
        </footer>
      </main>
    </div>
  )
}
