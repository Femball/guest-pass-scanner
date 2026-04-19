/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as ticketConfirmation } from './ticket-confirmation.tsx'
import { template as reminderDayBefore } from './reminder-day-before.tsx'
import { template as feedbackRequest } from './feedback-request.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'ticket-confirmation': ticketConfirmation,
  'reminder-day-before': reminderDayBefore,
  'feedback-request': feedbackRequest,
}
