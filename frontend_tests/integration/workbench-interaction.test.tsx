// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../frontend/src/app'
import { ExampleOverview } from '../../frontend/src/features/assignment/example-overview'
import { changeEligibility, exampleEligibility, type Eligibility } from '../../frontend/src/shared/examples/assignment'
import { LocaleProvider } from '../../frontend/src/shared/i18n/locale-context'
import { useTheme } from '../../frontend/src/shared/theme/use-theme'

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function button(label: string): HTMLButtonElement {
  const found = [...host.querySelectorAll('button')].find(node => node.textContent?.includes(label) || node.getAttribute('aria-label') === label)
  if (!found) throw new Error(`Missing button: ${label}`)
  return found
}

function Inputs() {
  const [eligibility, setEligibility] = useState<Eligibility>([[], ...exampleEligibility.slice(1)])
  return <ExampleOverview eligibility={eligibility} onChange={(job, person, allowed) => {
    setEligibility(current => changeEligibility(current, job, person, allowed))
  }} />
}

describe('workbench interactions without a browser', () => {
  it('filters only records needing attention and focuses the targeted editor, retaining other rows', async () => {
    await act(async () => root.render(<Inputs />))
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
    const filter = host.querySelector<HTMLInputElement>('.attention-filter input')!
    await act(async () => filter.click())
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(host.querySelector('tbody')?.textContent).toContain('Lift repair')
    await act(async () => button('Edit Lift repair').click())
    expect(host.querySelector<HTMLDetailsElement>('.eligibility-editor')?.open).toBe(true)
    expect(document.activeElement).toBe(host.querySelector('select'))
    expect(host.querySelector('fieldset')?.getAttribute('aria-describedby')).toBeTruthy()
    const alex = host.querySelectorAll<HTMLInputElement>('.eligibility-option input')[2]!
    await act(async () => alex.click())
    expect(host.querySelector('[role=status]')?.textContent).toBe('No jobs need attention.')
    expect(host.querySelector('fieldset')?.getAttribute('aria-describedby')).toBeNull()
    await act(async () => filter.click())
    expect(host.querySelectorAll('tbody tr')).toHaveLength(3)
    expect(host.querySelectorAll('tbody tr')[0]?.textContent).toContain('Alex')
    expect(host.querySelectorAll('tbody tr')[1]?.textContent).toContain('Alex or Sam')
  })

  it('exports the actual previous result during a failed rerun and replaces it only on successful retry', async () => {
    const responses: Array<(value: Response) => void> = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => responses.push(resolve))))
    await act(async () => root.render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>))
    expect(host.querySelector('.export-plan')).toBeNull()
    await act(async () => { button('Run example').click(); button('Run example').click(); await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(responses).toHaveLength(1)
    const respond = async (response: Response) => {
      await act(async () => { responses.shift()!(response); await new Promise(resolve => setTimeout(resolve, 20)) })
    }
    await respond(Response.json({ solution: { values: [8, 2, 3], score: { hard: 0, soft: 0 }, evaluated: 8 } }))
    const download = () => host.querySelector<HTMLAnchorElement>('.export-plan')!
    const original = download().href
    expect(decodeURIComponent(original)).toContain('"Lift repair","Alex"')
    await act(async () => { button('Run example').click(); await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(download().href).toBe(original)
    expect(host.textContent).toContain('Last successful plan')
    expect(button('Checking assignments').disabled).toBe(true)
    await respond(new Response('failure', { status: 500 }))
    expect(host.querySelector('[role=alert]')).not.toBeNull()
    expect(download().href).toBe(original)
    await act(async () => { button('Run example').click(); await new Promise(resolve => setTimeout(resolve, 20)) })
    await respond(Response.json({ solution: { values: [3, 8, 2], score: { hard: 0, soft: 0 }, evaluated: 8 } }))
    expect(decodeURIComponent(download().href)).toContain('"Lift repair","Noor"')
    expect(download().href).not.toBe(original)
    expect(host.querySelector('[role=alert]')).toBeNull()
  })

  it('shares and persists theme across mounted views and keeps controls usable when storage fails', async () => {
    function ThemeView() {
      const { theme, toggleTheme } = useTheme()
      return <button onClick={toggleTheme}>{theme}</button>
    }
    localStorage.setItem('orchestrata.theme', 'light')
    window.dispatchEvent(new StorageEvent('storage', { key: 'orchestrata.theme' }))
    await act(async () => root.render(<><ThemeView /><ThemeView /></>))
    await act(async () => button('light').click())
    expect([...host.querySelectorAll('button')].map(node => node.textContent)).toEqual(['dark', 'dark'])
    expect(localStorage.getItem('orchestrata.theme')).toBe('dark')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    await act(async () => button('dark').click())
    expect([...host.querySelectorAll('button')].map(node => node.textContent)).toEqual(['light', 'light'])
  })

  it('keeps translated controls and explicit main-content skip targets', async () => {
    await act(async () => root.render(<QueryClientProvider client={new QueryClient()}>
      <LocaleProvider initialLocale="fr-FR"><App /></LocaleProvider>
    </QueryClientProvider>))
    const skip = host.querySelector<HTMLAnchorElement>('.skip-link')!
    expect(skip.textContent).toBe('Aller au travail')
    expect(host.querySelector(skip.hash)?.getAttribute('tabindex')).toBe('-1')
    expect(host.querySelector('nav [aria-current=page]')?.textContent).toBe('Affectations')
    expect(host.querySelector('thead')?.textContent).toContain('Personnes éligibles')
  })
})

it('returns through the real shell without discarding edited inputs, result, locale, or theme', async () => {
  const { createMemoryHistory, createRootRoute, createRoute, createRouter, Link, RouterProvider } = await import('@tanstack/react-router')
  const { WorkbenchShell } = await import('../../frontend/src/shared/workbench/workbench-shell')
  const parent = createRootRoute({ component: WorkbenchShell })
  const index = createRoute({ getParentRoute: () => parent, path: '/', component: () => null })
  const catalog = createRoute({ getParentRoute: () => parent, path: '/recipes', component: () => <Link to="/">Return to assignments</Link> })
  const router = createRouter({ routeTree: parent.addChildren([index, catalog]), history: createMemoryHistory({ initialEntries: ['/'] }) })
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ solution: { values: [3, 8, 2], score: { hard: 0, soft: 0 }, evaluated: 8 } })))
  await act(async () => {
    await router.load()
    root.render(<QueryClientProvider client={new QueryClient()}><LocaleProvider initialLocale="en-US"><RouterProvider router={router} /></LocaleProvider></QueryClientProvider>)
  })
  await act(async () => button('Edit Lift repair').click())
  await act(async () => host.querySelectorAll<HTMLInputElement>('.eligibility-option input')[2]!.click())
  await act(async () => { button('Run edited setup').click(); await new Promise(resolve => setTimeout(resolve, 40)) })
  const csv = host.querySelector<HTMLAnchorElement>('.export-plan')!.href
  const theme = host.querySelector('.shell')!.getAttribute('data-theme')
  const recipes = [...host.querySelectorAll('nav a')].find(node => node.textContent === 'Recipes') as HTMLAnchorElement
  await act(async () => { recipes.click(); await new Promise(resolve => setTimeout(resolve, 20)) })
  expect(router.state.location.pathname).toBe('/recipes')
  expect(host.querySelector('[hidden]')).not.toBeNull()
  await act(async () => { await router.navigate({ to: '/' }) })
  expect(host.querySelector('[hidden]')).toBeNull()
  expect(document.documentElement.lang).toBe('en-US')
  expect(host.querySelector<HTMLAnchorElement>('.export-plan')!.href).toBe(csv)
  expect(host.querySelectorAll('tbody tr')[0]?.textContent).toContain('Noor')
  expect(host.querySelectorAll('tbody tr')[0]?.textContent).not.toContain('Alex')
  expect(host.querySelector('.shell')!.getAttribute('data-theme')).toBe(theme)
  expect(host.querySelector<HTMLDetailsElement>('.eligibility-editor')?.open).toBe(true)
})
