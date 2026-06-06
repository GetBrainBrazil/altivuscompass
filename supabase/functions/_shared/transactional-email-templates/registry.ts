/// <reference types="npm:@types/react@18.3.1" />
import type { ComponentType } from 'npm:react@18.3.1'
import { template as taskReminder } from './task-reminder.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  // deno-lint-ignore no-explicit-any
  previewData?: any
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'task-reminder': taskReminder,
}
