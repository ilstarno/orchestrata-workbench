import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRecipeDetailApi } from '../../frontend/src/features/recipes/detail/recipe-detail-api'

const { preview, run } = createRecipeDetailApi('https://example.com')
const id = 'field-service'
const metadata = {
  id, title: 'Field service', scenario: 'Assign service jobs',
  inputs: [{ name: 'Job', description: 'Service job', required: true, kind: 'string' }],
  outputs: [],
}
const exampleJson = '{"variables":[{"name":"job","domain":[9223372036854775807]}],"constraints":[]}'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('recipe detail and synthetic run', () => {
  it('requests the chosen recipe and its bundled input, keeping exact numeric wire text', async () => {
    const request = vi.fn(async (req: Request) => (
      req.url.endsWith('/example')
        ? new Response(exampleJson)
        : Response.json(metadata)
    ))
    vi.stubGlobal('fetch', request)
    await expect(preview(id)).resolves.toEqual({ metadata, exactExampleJson: exampleJson })
    expect(request.mock.calls.map(([req]) => [req.method, new URL(req.url).pathname])).toEqual([
      ['GET', '/api/v1/recipes/field-service'],
      ['GET', '/api/v1/recipes/field-service/example'],
    ])
  })

  it('refuses wrong-recipe metadata and malformed examples', async () => {
    vi.stubGlobal('fetch', async (req: Request) => (
      req.url.endsWith('/example') ? new Response(exampleJson) : Response.json({ ...metadata, id: 'other' })
    ))
    await expect(preview(id)).rejects.toThrow('Invalid recipe metadata')
    vi.stubGlobal('fetch', async (req: Request) => (
      req.url.endsWith('/example') ? Response.json({ variables: false }) : Response.json(metadata)
    ))
    await expect(preview(id)).rejects.toThrow('Invalid recipe example')
  })

  it('runs the server example with an empty body and only claims infeasible when the server says so', async () => {
    const request = vi.fn(async (req: Request) => {
      expect(req.method).toBe('POST')
      expect(new URL(req.url).pathname).toBe('/api/v1/recipes/field-service/run-example')
      expect(await req.text()).toBe('')
      return Response.json({ solution: null })
    })
    vi.stubGlobal('fetch', request)
    await expect(run(id)).resolves.toEqual({ kind: 'infeasible' })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('preserves overlarge results instead of rounding them and propagates stable backend failures', async () => {
    const exact = '{"solution":{"values":[9223372036854775807],"score":{"hard":0,"soft":0},"evaluated":1}}'
    vi.stubGlobal('fetch', async () => new Response(exact))
    await expect(run(id)).resolves.toEqual({ kind: 'exact-json', json: exact })
    vi.stubGlobal('fetch', async () => new Response('', { status: 503, headers: { 'x-orchestrata-error-code': 'solver_busy' } }))
    await expect(run(id)).rejects.toMatchObject({ kind: 'busy', code: 'solver_busy' })
  })
})
