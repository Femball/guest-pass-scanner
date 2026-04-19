import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { html?: string; periodLabel?: string }

const WeeklyReportEmail = ({ html = '', periodLabel = '' }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Rapport hebdo L'Access — {periodLabel}</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0 }}>
      <Container style={{ padding: 0, maxWidth: '640px' }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyReportEmail,
  subject: (d: Record<string, any>) => `📊 Rapport hebdo L'Access — ${d.periodLabel ?? ''}`,
  displayName: 'Rapport hebdo',
  previewData: { html: '<p>Aperçu</p>', periodLabel: 'Sem. demo' },
} satisfies TemplateEntry
