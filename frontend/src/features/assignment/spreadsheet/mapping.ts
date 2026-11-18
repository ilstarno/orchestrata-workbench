import type { PlanningInput } from '../planning-input'
import type { SheetSelection } from './sheet-selection'
import { headers, sourceRows, type Workbook } from './workbook'
export type Group = 'jobs' | 'people'
export type Field = 'name' | 'skill' | 'skills' | 'available' | 'capacity'
export const fields: Record<Group, readonly Field[]> = { jobs: ['name', 'skill'], people: ['name', 'skills', 'available', 'capacity'] }
export interface Issue { code: 'missing' | 'duplicate' | 'text' | 'skills' | 'available' | 'capacity' | 'limit' | 'empty' | 'unmapped'; group: Group; sheet?: number; row?: number; column?: number; field?: Field }
const key = (value: string) => value.normalize('NFC').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[\s_.-]+/g, ' ')
const aliases: Record<string, string[]> = {
  name: ['name', 'nom', 'emri'], jobName: ['job name', 'task name', 'job title', 'work order title', 'work order description', 'service request title'],
  personName: ['person name', 'worker name', 'technician name', 'employee name', 'staff member', 'full name'],
  skill: ['required skill', 'skill required', 'skill', 'compétence requise', 'aftësia e kërkuar', 'required trade', 'trade required', 'skill needed', 'required qualification'],
  skills: ['skills', 'worker skills', 'competencies', 'compétences', 'aftësitë', 'trades', 'technician skills', 'qualifications', 'certifications'],
  available: ['available', 'availability', 'disponible', 'disponibilité', 'në dispozicion', 'available for work', 'available today', 'can take jobs', 'available (yes/no)'],
  capacity: ['job limit', 'capacity (jobs)', 'max jobs', 'maximum jobs', 'limite de tâches', 'kufiri i detyrave', 'daily job limit', 'max jobs per technician', 'job capacity'],
}
export function suggestFields(group: Group, heading: string[]): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const field of fields[group]) {
    const names = [...aliases[field], ...(field === 'name' ? aliases[group === 'jobs' ? 'jobName' : 'personName'] : [])].map(key)
    const matches = heading.flatMap((name, column) => names.includes(key(name)) ? [column] : [])
    result[field] = matches.length === 1 ? matches[0] : null
  }
  return result
}
export function suggestMapping(book: Workbook, paired: boolean): SheetSelection {
  function group(role: Group) {
    const matches = book.sheets.flatMap((sheet, i) => Object.values(suggestFields(role, headers(sheet))).every(v => v !== null) ? [i] : [])
    const sheet = paired ? role === 'jobs' ? 0 : 1 : matches.length === 1 ? matches[0] : null
    return { sheet, ...suggestFields(role, sheet === null ? [] : headers(book.sheets[sheet])) }
  }
  return { jobs: group('jobs'), people: group('people') } as unknown as SheetSelection
}
const validText = (text: string) => !/[\u0000-\u001f\u007f]/.test(text) && text.trim().length > 0 && text.trim().length <= 80
export function checkMapping(book: Workbook, mapping: SheetSelection): { input?: PlanningInput; issues: Issue[] } {
  const issues: Issue[] = []
  for (const group of ['jobs', 'people'] as const) {
    const selected = mapping[group] as unknown as Record<string, number | null>
    const sheet = selected.sheet === null ? undefined : book.sheets[selected.sheet]
    if (!sheet) { issues.push({ code: 'missing', group }); continue }
    const used = new Set<number>()
    for (const field of fields[group]) {
      const column = selected[field]
      if (column === null || !Number.isInteger(column) || column < 0 || column >= headers(sheet).length) issues.push({ code: 'missing', group, field })
      else if (used.has(column)) issues.push({ code: 'duplicate', group, field, column })
      else used.add(column)
    }
  }
  if (mapping.jobs.sheet !== null && mapping.jobs.sheet === mapping.people.sheet) issues.push({ code: 'duplicate', group: 'people' })
  if (issues.length) return { issues }
  const jobs = sourceRows(book.sheets[mapping.jobs.sheet!]), people = sourceRows(book.sheets[mapping.people.sheet!])
  if (jobs.length + people.length > 200) return { issues: [{ code: 'limit', group: 'jobs' }] }
  if (!jobs.length) return { issues: [{ code: 'empty', group: 'jobs' }] }
  const input: PlanningInput = { jobs: [], people: [] }
  const yes = new Set(['yes', 'true', '1', 'oui', 'po']), no = new Set(['no', 'false', '0', 'non', 'jo'])
  for (const group of ['jobs', 'people'] as const) {
    const selected = mapping[group] as unknown as Record<string, number>
    for (const { cells, row } of group === 'jobs' ? jobs : people) {
      const value = (field: Field) => cells[selected[field]] ?? ''
      const issue = (code: Issue['code'], field?: Field) => issues.push({ code, group, sheet: selected.sheet, row, field, column: field ? selected[field] : undefined })
      if (fields[group].every(field => !value(field).trim())) { issue('unmapped'); continue }
      if (!validText(value('name'))) issue('text', 'name')
      if (group === 'jobs') {
        if (!validText(value('skill'))) issue('text', 'skill')
        input.jobs.push({ name: value('name').trim(), skill: value('skill').trim() })
      } else {
        const skills = value('skills').split(',').map(s => s.trim()).filter(Boolean)
        if (/[\u0000-\u001f\u007f]/.test(value('skills')) || skills.length > 20 || skills.some(s => !validText(s))) issue('skills', 'skills')
        const available = key(value('available'))
        if (/[\u0000-\u001f\u007f]/.test(value('available')) || (!yes.has(available) && !no.has(available))) issue('available', 'available')
        const capacity = Number(value('capacity').trim())
        if (!/^\d+$/.test(value('capacity').trim()) || capacity > 200) issue('capacity', 'capacity')
        input.people.push({ name: value('name').trim(), skills, available: yes.has(available), capacity })
      }
    }
  }
  return issues.length ? { issues } : { issues, input }
}
