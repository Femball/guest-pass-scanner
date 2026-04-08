import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "L'Access"

interface Ticket {
  clientName: string
  qrCode: string
}

interface TicketConfirmationProps {
  mainName?: string
  eventName?: string
  eventDate?: string
  qrColor?: string
  tickets?: Ticket[]
}

const TicketConfirmationEmail = ({
  mainName = 'Invité',
  eventName = 'Soirée',
  eventDate = '',
  qrColor = '0f9b6e',
  tickets = [],
}: TicketConfirmationProps) => {
  const ticketCount = tickets.length || 1
  const subtitle = ticketCount > 1
    ? `${ticketCount} tickets pour ${eventName}`
    : eventName

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{ticketCount > 1 ? `Vos ${ticketCount} tickets` : 'Votre ticket'} pour {eventName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerSection}>
            <Heading style={headerTitle}>🎫 {ticketCount > 1 ? 'Vos Tickets' : 'Votre Ticket'}</Heading>
            <Text style={headerSubtitle}>{subtitle}</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={greeting}>Bonjour <strong>{mainName}</strong>,</Text>
            <Text style={introText}>
              {ticketCount > 1
                ? `Votre réservation pour ${ticketCount} personnes est confirmée ! Voici les QR codes à présenter à l'entrée.`
                : `Votre réservation est confirmée ! Présentez ce QR code à l'entrée pour accéder à l'événement.`}
            </Text>

            {tickets.map((t, i) => {
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=${qrColor}&data=${encodeURIComponent(t.qrCode)}`
              return (
                <Section key={i} style={ticketCard}>
                  <Text style={{ ...brandName, color: `#${qrColor}` }}>{SITE_NAME}</Text>
                  <Img src={qrUrl} alt="QR Code" width="180" height="180" style={qrImage} />
                  <Text style={ticketName}>{t.clientName}</Text>
                  {eventDate && <Text style={ticketDate}>📅 {eventDate}</Text>}
                  <Text style={ticketCode}>{t.qrCode}</Text>
                </Section>
              )
            })}

            <Section style={warningBox}>
              <Text style={warningTitle}>⚠️ Important</Text>
              <Text style={warningText}>
                {ticketCount > 1
                  ? 'Chaque ticket est personnel et à usage unique. Chaque QR code ne peut être utilisé qu\'une seule fois.'
                  : 'Ce ticket est personnel et à usage unique. Il ne peut être utilisé qu\'une seule fois.'}
              </Text>
            </Section>
          </Section>

          <Hr style={divider} />

          <Section style={footerSection}>
            <Text style={footerText}>{SITE_NAME} - Gestion sécurisée des accès</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TicketConfirmationEmail,
  subject: (data: Record<string, any>) => {
    const count = data.tickets?.length || 1
    const eventName = data.eventName || 'Soirée'
    return `🎉 ${count > 1 ? `Vos ${count} tickets` : 'Votre ticket'} pour ${eventName}`
  },
  displayName: 'Confirmation de tickets',
  previewData: {
    mainName: 'Jean Dupont',
    eventName: 'Soirée VIP',
    eventDate: '2026-04-15',
    qrColor: '0f9b6e',
    tickets: [
      { clientName: 'Jean Dupont', qrCode: 'TICKET-PREVIEW-001' },
      { clientName: 'Marie Dupont', qrCode: 'TICKET-PREVIEW-002' },
    ],
  },
} satisfies TemplateEntry

// Styles
const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }
const container = { maxWidth: '500px', margin: '0 auto' }
const headerSection = { background: 'linear-gradient(135deg, #0f9b6e 0%, #0d8a5f 100%)', padding: '30px', textAlign: 'center' as const, borderRadius: '16px 16px 0 0' }
const headerTitle = { color: '#ffffff', margin: '0', fontSize: '28px', fontWeight: '700' }
const headerSubtitle = { color: 'rgba(255,255,255,0.9)', margin: '10px 0 0', fontSize: '16px' }
const contentSection = { padding: '30px' }
const greeting = { color: '#374151', fontSize: '18px', margin: '0 0 10px' }
const introText = { color: '#6b7280', fontSize: '16px', lineHeight: '1.6', margin: '0 0 25px' }
const ticketCard = { textAlign: 'center' as const, padding: '25px', backgroundColor: '#f9fafb', borderRadius: '12px', marginBottom: '15px' }
const brandName = { fontSize: '20px', fontWeight: '900', letterSpacing: '3px', margin: '0 0 10px' }
const qrImage = { borderRadius: '8px', margin: '0 auto' }
const ticketName = { color: '#374151', fontSize: '16px', fontWeight: '600', margin: '10px 0 5px' }
const ticketDate = { color: '#6b7280', fontSize: '14px', margin: '5px 0 0' }
const ticketCode = { color: '#9ca3af', fontSize: '11px', margin: '8px 0 0', fontFamily: 'monospace' }
const warningBox = { backgroundColor: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '15px', borderRadius: '0 8px 8px 0', marginTop: '10px' }
const warningTitle = { color: '#92400e', fontSize: '14px', margin: '0', fontWeight: '500' }
const warningText = { color: '#a16207', fontSize: '14px', margin: '8px 0 0' }
const divider = { borderColor: '#e5e7eb', margin: '0' }
const footerSection = { padding: '20px', textAlign: 'center' as const }
const footerText = { color: '#9ca3af', fontSize: '12px', margin: '0' }
