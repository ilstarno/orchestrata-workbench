export const supportedLocales = ['en-US', 'de-DE', 'nl-NL', 'it-IT', 'pl-PL', 'fr-FR'] as const

export type Locale = (typeof supportedLocales)[number]

export const defaultLocale: Locale = 'en-US'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && supportedLocales.some(locale => value === locale)
}
