import { useId } from 'react'
import { Languages } from 'lucide-react'
import { useLocale } from './locale-context'
import { isLocale, supportedLocales } from './supported-locales'
import { translate } from './messages'
import './language-picker.css'

export function LanguagePicker() {
  const id = useId()
  const { locale, setLocale, t } = useLocale()
  return (
    <div className="language-picker">
      <label htmlFor={id}>
        <Languages size={18} aria-hidden />
        <span className="sr-only">{t('language', 'label')}</span>
      </label>
      <select id={id} value={locale} onChange={event => {
        if (isLocale(event.currentTarget.value)) setLocale(event.currentTarget.value)
      }}>
        {supportedLocales.map(option => (
          <option key={option} value={option} lang={option}>
            {translate(option, 'language', option)}
          </option>
        ))}
      </select>
    </div>
  )
}
