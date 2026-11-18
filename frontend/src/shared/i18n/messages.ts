/// <reference types="vite/client" />
import type spreadsheet from '../../locales/en-US/spreadsheet.json'
import type app from '../../locales/en-US/app.json'
import type appShell from '../../locales/en-US/app-shell.json'
import type exampleOverview from '../../locales/en-US/example-overview.json'
import type planResult from '../../locales/en-US/plan-result.json'
import type grid from '../../locales/en-US/grid.json'
import type language from '../../locales/en-US/language.json'
import type recipeGrid from '../../locales/en-US/recipe-grid.json'
import { defaultLocale, type Locale } from './supported-locales'

interface Components {
  spreadsheet: typeof spreadsheet
  app: typeof app
  'app-shell': typeof appShell
  'example-overview': typeof exampleOverview
  'plan-result': typeof planResult
  grid: typeof grid
  language: typeof language
  'recipe-grid': typeof recipeGrid
}

type Dictionary = Record<string, string>
export type FormatValues = Record<string, string>
export type MessageComponent = keyof Components
export type MessageKey<Component extends MessageComponent> = keyof Components[Component] & string
const dictionaries = import.meta.glob<Dictionary>('../../locales/*/*.json', {
  eager: true,
  import: 'default',
})
const marker = /\{([A-Za-z][A-Za-z0-9_]*)\}/g

export function translate<Component extends MessageComponent>(
  locale: Locale,
  component: Component,
  key: MessageKey<Component>,
  values: FormatValues = {},
): string {
  const translated = dictionaries[`../../locales/${locale}/${component}.json`]?.[key]
  const base = dictionaries[`../../locales/${defaultLocale}/${component}.json`]?.[key]
  return (translated ?? base ?? key).replace(marker, (match, name: string) => values[name] ?? match)
}
