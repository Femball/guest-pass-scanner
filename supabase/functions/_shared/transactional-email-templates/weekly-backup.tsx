import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props { html?: string; count?: number; date?: string }

const WeeklyBackupEmail = ({ html = '', count = 0, date = '' }: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Backup L'Access — {count} réservations</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0 }}>
      <Container style={{ padding: 0, maxWidth: '640px' }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyBackupEmail,
  subject: (d: Record<string, any>) => `💾 Backup L'Access du ${d.date ?? ''} (${d.count ?? 0} réservations)`,
  displayName: 'Backup hebdo',
  previewData: { html: '<p>Aperçu</p>', count: 42, date: '2026-04-19' },
} satisfies TemplateEntry
