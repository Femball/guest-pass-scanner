import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "L'Access"

interface FeedbackProps {
  mainName?: string
  feedbackUrl?: string
  eventDate?: string
}

const FeedbackRequestEmail = ({
  mainName = 'Invité',
  feedbackUrl = '#',
  eventDate = '',
}: FeedbackProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Comment s'est passée votre soirée {SITE_NAME} ?</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Merci d'être venu(e), {mainName} !</Heading>
        <Text style={text}>
          Nous espérons que vous avez passé une excellente soirée hier{eventDate ? ` (${eventDate})` : ''}.
          Votre avis nous aide à toujours mieux faire — cela ne prend que 30 secondes.
        </Text>

        <Section style={ctaBox}>
          <Button href={feedbackUrl} style={button}>
            Donner mon avis ⭐
          </Button>
          <Text style={helperText}>
            Une note de 1 à 5 étoiles + un commentaire libre, c'est tout.
          </Text>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          Merci pour votre confiance,<br />
          L'équipe {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FeedbackRequestEmail,
  subject: `Votre avis sur la soirée ${SITE_NAME} ?`,
  displayName: 'Enquête J+1',
  previewData: {
    mainName: 'Sophie',
    feedbackUrl: 'https://example.com/feedback?token=demo',
    eventDate: 'vendredi 18 avril 2026',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 20px' }
const ctaBox = { textAlign: 'center' as const, padding: '20px 0' }
const button = {
  backgroundColor: '#c9a84c',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
}
const helperText = { fontSize: '13px', color: '#888888', margin: '12px 0 0' }
const hr = { borderColor: '#e6e6e6', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#666666', margin: '20px 0 0', textAlign: 'center' as const }
