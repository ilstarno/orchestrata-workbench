import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type FormatValues, type MessageComponent, type MessageKey } from './messages'
import { defaultLocale, isLocale, type Locale } from './supported-locales'

const storageKey = 'orchestrata.locale'

interface LocaleContext {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const Context = createContext<LocaleContext>({ locale: defaultLocale, setLocale: () => undefined })

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocale] = useState<Locale>(() => initialLocale ?? restoreLocale())
  useEffect(() => {
    document.documentElement.lang = locale
    try {
      localStorage.setItem(storageKey, locale)
    } catch {
      // Changing language remains available if this browser blocks storage.
    }
  }, [locale])
  const value = useMemo(() => ({ locale, setLocale }), [locale])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useLocale() {
  const { locale, setLocale } = useContext(Context)
  return {
    locale,
    setLocale,
    t: <Component extends MessageComponent>(
      component: Component,
      key: MessageKey<Component>,
      values?: FormatValues,
    ) => translate(locale, component, key, values),
  }
}

function restoreLocale(): Locale {
  try {
    const stored = localStorage.getItem(storageKey)
    return isLocale(stored) ? stored : defaultLocale
  } catch {
    return defaultLocale
  }
}
