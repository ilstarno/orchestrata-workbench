import { Link, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Button } from 'react-aria-components'
import { Braces, Moon, Sun } from 'lucide-react'
import { LanguagePicker } from '../i18n/language-picker'
import { useLocale } from '../i18n/locale-context'
import { useTheme } from '../theme/use-theme'

export function WorkbenchHeader({
  active,
  mainId,
  navigation,
}: {
  active: 'assignment' | 'recipes'
  mainId: string
  navigation?: ReactNode
}) {
  const router = useRouter({ warn: false })
  const brand = (
    <>
      <span className="brand-mark">
        <Braces size={20} aria-hidden />
      </span>
      <span>
        orchestrata<span className="brand-dot">.</span>
      </span>
    </>
  )
  const { t } = useLocale()
  const { theme, toggleTheme } = useTheme()
  return (
    <>
      <a className="skip-link" href={`#${mainId}`}>
        {t('app-shell', 'skipToWork')}
      </a>
      <header className="topbar topbar--localized">
        {router ? (
          <Link className="brand" to="/" aria-label={t('app-shell', 'homeLabel')}>
            {brand}
          </Link>
        ) : (
          <a className="brand" href="/" aria-label={t('app-shell', 'homeLabel')}>
            {brand}
          </a>
        )}
        <nav className="workspace-navigation" aria-label={t('app-shell', 'workspaceNavigation')}>
          {navigation ?? (
            <>
              <a href="/" aria-current={active === 'assignment' ? 'page' : undefined}>
                {t('app-shell', 'assignment')}
              </a>
              <a href="/recipes" aria-current={active === 'recipes' ? 'page' : undefined}>
                {t('app-shell', 'recipes')}
              </a>
            </>
          )}
        </nav>
        <div className="top-actions">
          <LanguagePicker />
          <Button
            className="theme-button"
            aria-label={t('app-shell', theme === 'dark' ? 'lightTheme' : 'darkTheme')}
            onPress={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
          </Button>
        </div>
      </header>
    </>
  )
}
