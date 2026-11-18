import type { MessageKey } from '../../../shared/i18n/messages'
export type ImportFeedback =
  | { component: 'spreadsheet'; key: MessageKey<'spreadsheet'> }
  | { component: 'plan-result'; key: MessageKey<'plan-result'> }
