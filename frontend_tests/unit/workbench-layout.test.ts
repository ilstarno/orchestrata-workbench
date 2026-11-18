import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('declares narrow-screen reflow, optional motion and visible keyboard focus without claiming browser layout coverage', () => {
  const css = readFileSync(new URL('../../frontend/src/styles.css', import.meta.url), 'utf8')
  expect(css).toContain('@media (max-width: 1000px)')
  expect(css).toContain('grid-template-columns: minmax(0, 1fr)')
  expect(css).toContain('@media (max-width: 700px)')
  expect(css).toContain('.workspace-navigation { order: 3; width: 100%; }')
  expect(css).toContain('prefers-reduced-motion: reduce')
  expect(css).toContain('outline: 3px solid var(--accent)')
  expect(css).toContain('min-height: 44px')
  expect(css).not.toMatch(/(?:^|[;{])\s*height: 100vh/)
})
