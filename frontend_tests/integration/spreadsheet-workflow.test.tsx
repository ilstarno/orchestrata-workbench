// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SpreadsheetPlan } from '../../frontend/src/features/assignment/spreadsheet/spreadsheet-plan'
import { LocaleProvider } from '../../frontend/src/shared/i18n/locale-context'
let host: HTMLDivElement, root: Root
const tick = () => new Promise(resolve => setTimeout(resolve, 20))
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('Blob', NodeBlob)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<SpreadsheetPlan />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); localStorage.clear(); vi.unstubAllGlobals() })
const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text)!
async function click(node: HTMLElement) { await act(async () => { node.click(); await tick() }) }
async function waitFor(text: string) {
  await vi.waitFor(async () => { await act(async () => { await tick() }); expect(host.textContent).toContain(text) })
}
async function upload(index: number, data: string | Uint8Array, name: string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const file = new File([bytes.slice().buffer], name)
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.slice().buffer })
  const input = host.querySelectorAll<HTMLInputElement>('input[type=file]')[index]
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
}
function confirmation() {
  return [...host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].find(input => input.parentElement?.textContent?.includes('I confirm'))!
}
const jobs = 'Name,Required skill\nGate,Repair\nDoor,Repair\n'
const people = 'Name,Skills,Available,Job limit\nMika,Repair,Maybe,1\n'
const result = () => Response.json({ solution: { values: [0, 2], score: { hard: 0, soft: -1 }, evaluated: 4 } })
it('opens real CSV files, corrects only the flagged cell, confirms mapping, runs, and retains export after 401/403/500/limit failures', async () => {
  const fetcher = vi.fn(async () => result()); vi.stubGlobal('fetch', fetcher)
  await click(host.querySelector<HTMLInputElement>('input[type=checkbox]')!)
  await upload(0, jobs, 'jobs.csv'); await upload(1, people, 'people.csv')
  await click(button('Open and preview')); await waitFor('Needs attention')
  expect(fetcher).not.toHaveBeenCalled()
  expect(button('Run spreadsheet plan').disabled).toBe(true)
  expect(host.querySelectorAll('.import-issue form')).toHaveLength(1)
  const correction = host.querySelector<HTMLInputElement>('.import-issue input')!
  expect(correction.value).toBe('Maybe')
  expect(correction.getAttribute('aria-invalid')).toBe('true')
  expect(document.getElementById(correction.getAttribute('aria-describedby')!)?.textContent).toContain('Use Yes/No')
  await act(async () => { correction.value = 'Oui'; host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  await waitFor('2 jobs and 1 people ready')
  expect(document.activeElement).toBe(confirmation())
  await click(confirmation()); await click(button('Save column choices'))
  expect(localStorage.getItem('orchestrata.assignment-columns.v1')).not.toContain('Mika')
  await click(button('Run spreadsheet plan')); await waitFor('Spreadsheet plan')
  await vi.waitFor(() => expect(host.querySelector('.export-import')).not.toBeNull())
  const original = host.querySelector<HTMLAnchorElement>('.export-import')!.href
  expect(decodeURIComponent(original)).toContain('"2","Gate","Mika"')
  expect(decodeURIComponent(original)).toContain('"3","Door",""')
  expect(fetcher).toHaveBeenCalledWith('/api/v1/solve', expect.objectContaining({ credentials: 'same-origin' }))
  for (const status of [401, 403, 500, 422]) {
    fetcher.mockImplementationOnce(async () => new Response('Search space exceeds the evaluation limit', { status }))
    await click(button('Run spreadsheet plan'))
    await vi.waitFor(async () => { await act(tick); expect(host.querySelector('[role=alert]')).not.toBeNull() })
    expect(host.textContent).toContain('Last successful spreadsheet plan')
    expect(host.querySelector<HTMLAnchorElement>('.export-import')!.href).toBe(original)
    expect(confirmation().checked).toBe(true)
    if (status === 401 || status === 403) expect(host.textContent).toContain('session or permissions')
  }
  const calls = fetcher.mock.calls.length
  await upload(0, 'Name,Skill\n"broken', 'broken.csv'); await upload(1, people, 'people.csv')
  await click(button('Open and preview'))
  await vi.waitFor(async () => { await act(tick); expect(host.querySelector('[role=alert]')).not.toBeNull() })
  expect(fetcher).toHaveBeenCalledTimes(calls)
  expect(host.querySelector<HTMLAnchorElement>('.export-import')!.href).toBe(original)
  expect(confirmation().checked).toBe(true)
  expect([...host.querySelectorAll<HTMLInputElement>('input[type=file]')].every(input => input.value === '')).toBe(true)
})

it('uses actual XLSX bytes through upload, preview, confirmation and server request', async () => {
  const fetcher = vi.fn(async () => Response.json({ solution: { values: [0, 2, 1], score: { hard: 0, soft: -2 }, evaluated: 18 } }))
  vi.stubGlobal('fetch', fetcher)
  await upload(0, new Uint8Array(readFileSync(resolve('../frontend_tests/fixtures/spreadsheet/example.xlsx'))), 'example.xlsx')
  await click(button('Open and preview')); await waitFor('3 jobs and 3 people ready')
  expect(fetcher).not.toHaveBeenCalled()
  await click(confirmation()); await click(button('Run spreadsheet plan'))
  await vi.waitFor(async () => { await act(tick); expect(host.querySelector('.export-import')).not.toBeNull() })
  expect(host.querySelector('[aria-labelledby=import-result-heading]')?.textContent).toContain('Repair shop doorTechnician A')
  expect(fetcher.mock.calls).toHaveLength(1)
})

it('renders the import task in French while preserving source headings and values', async () => {
  await act(async () => root.render(<LocaleProvider initialLocale="fr-FR"><SpreadsheetPlan /></LocaleProvider>))
  expect(host.textContent).toContain('Planifier depuis un tableur')
  expect(host.textContent).toContain('Valeurs uniquement')
})

it.runIf(!!process.env.ORCHESTRATA_TEST_API)('runs real XLSX and CSV uploads through the existing local server', async () => {
  const base = process.env.ORCHESTRATA_TEST_API!
  expect(base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  const nativeFetch = globalThis.fetch
  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => nativeFetch(base + path, init))
  await upload(0, new Uint8Array(readFileSync(resolve('../frontend_tests/fixtures/spreadsheet/example.xlsx'))), 'example.xlsx')
  await click(button('Open and preview')); await waitFor('3 jobs and 3 people ready')
  await click(confirmation()); await click(button('Run spreadsheet plan'))
  await vi.waitFor(async () => { await act(tick); expect(host.querySelectorAll('[aria-labelledby=import-result-heading] tbody tr')).toHaveLength(3) })
  expect(host.querySelector('[aria-labelledby=import-result-heading]')?.textContent).not.toContain('Unassigned')
  await click(host.querySelector<HTMLInputElement>('input[type=checkbox]')!)
  await upload(0, jobs, 'jobs.csv'); await upload(1, people.replace('Maybe', 'Po'), 'people.csv')
  await click(button('Open and preview')); await waitFor('2 jobs and 1 people ready')
  await click(confirmation()); await click(button('Run spreadsheet plan'))
  await vi.waitFor(async () => { await act(tick); expect(host.querySelectorAll('[aria-labelledby=import-result-heading] tbody tr')).toHaveLength(2) })
  const rows = host.querySelector('[aria-labelledby=import-result-heading] tbody')!.textContent!
  expect(rows.match(/Mika/g)).toHaveLength(1)
  expect(rows.match(/Unassigned/g)).toHaveLength(1)
  const previous = host.querySelector<HTMLAnchorElement>('.export-import')!.href
  await upload(0, 'Name,Required skill\n' + Array.from({ length: 17 }, (_, i) => `Job ${i},Repair`).join('\n'), 'large.csv')
  await upload(1, people.replace('Maybe', 'Yes'), 'people.csv')
  await click(button('Open and preview')); await waitFor('17 jobs and 1 people ready')
  await click(confirmation()); await click(button('Run spreadsheet plan'))
  await waitFor('This run was too large to check.')
  expect(host.querySelector<HTMLAnchorElement>('.export-import')!.href).toBe(previous)
  await upload(0, 'Name,Required skill\nOne job,Repair\n', 'single.csv')
  await upload(1, 'Name,Skills,Available,Job limit\n', 'empty-roster.csv')
  await click(button('Open and preview')); await waitFor('1 jobs and 0 people ready')
  await click(confirmation()); await click(button('Run spreadsheet plan'))
  await vi.waitFor(async () => { await act(tick); expect(host.querySelectorAll('[aria-labelledby=import-result-heading] tbody tr')).toHaveLength(1) })
  expect(host.querySelector('[aria-labelledby=import-result-heading] tbody')!.textContent).toContain('Unassigned')
})


it('keeps the successful plan tied to its original input after a new review and failed rerun', async () => {
  const fetcher = vi.fn(async () => result()); vi.stubGlobal('fetch', fetcher)
  await click(host.querySelector<HTMLInputElement>('input[type=checkbox]')!)
  await upload(0, jobs, 'first-jobs.csv'); await upload(1, people.replace('Maybe', 'Yes'), 'first-people.csv')
  await click(button('Open and preview')); await waitFor('2 jobs and 1 people ready')
  await click(confirmation()); await click(button('Run spreadsheet plan'))
  await vi.waitFor(async () => { await act(tick); expect(host.querySelector('.export-import')).not.toBeNull() })
  const original = host.querySelector<HTMLAnchorElement>('.export-import')!.href
  expect(host.querySelector('.plan-input-context')?.textContent).toContain('first-jobs.csv')
  expect(host.querySelector('[aria-labelledby=import-result-heading]')?.textContent).toContain('1 assigned · 1 unassigned')
  await upload(0, jobs.replace('Gate', 'Other gate'), 'next-jobs.csv'); await upload(1, people.replace('Maybe', 'Yes'), 'next-people.csv')
  await click(button('Open and preview')); await waitFor('next-jobs.csv')
  expect(host.querySelector('.plan-input-context')?.textContent).not.toContain('next-jobs.csv')
  expect(host.querySelector('.plan-input-context')?.textContent).toContain('first-jobs.csv')
  expect(host.textContent).toContain('Last successful spreadsheet plan')
  expect(confirmation().checked).toBe(false)
  fetcher.mockImplementationOnce(async () => new Response('', { status: 403 }))
  await click(confirmation()); await click(button('Run spreadsheet plan'))
  await vi.waitFor(async () => { await act(tick); expect(host.querySelector('[role=alert]')).not.toBeNull() })
  expect(host.querySelector<HTMLAnchorElement>('.export-import')!.href).toBe(original)
  expect(host.querySelector('.plan-input-context')?.textContent).toContain('first-jobs.csv')
})
