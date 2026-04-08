import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "L'Access"
const LOGO_URL = 'https://cgowurmyyrkftiqweavn.supabase.co/storage/v1/object/public/email-assets/logo-email.png'

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
          {/* Header with logo */}
          <Section style={headerSection}>
            <Text style={headerBrand}>L'ACCESS</Text>
            <Heading style={headerTitle}>
              {ticketCount > 1 ? `Vos ${ticketCount} Tickets` : 'Votre Ticket'}
            </Heading>
            <Text style={headerSubtitle}>{subtitle}</Text>
          </Section>

          {/* Content */}
          <Section style={contentSection}>
            <Text style={greeting}>
              Bonjour <strong>{mainName}</strong>,
            </Text>
            <Text style={introText}>
              {ticketCount > 1
                ? `Votre réservation pour ${ticketCount} personnes est confirmée ! Voici les QR codes à présenter à l'entrée.`
                : `Votre réservation est confirmée ! Présentez ce QR code à l'entrée pour accéder à l'événement.`}
            </Text>

            {/* Ticket cards */}
            {tickets.map((t, i) => {
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=${qrColor}&data=${encodeURIComponent(t.qrCode)}`
              return (
                <Section key={i} style={ticketCard}>
                  <Section style={ticketCardInner}>
                    <Text style={ticketBrand}>{SITE_NAME}</Text>
                    <Hr style={ticketDivider} />
                    <Img src={qrUrl} alt="QR Code" width="180" height="180" style={qrImage} />
                    <Text style={ticketName}>{t.clientName}</Text>
                    {eventDate && (
                      <Text style={ticketDate}>
                        📅 {new Date(eventDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </Text>
                    )}
                    <Text style={ticketCode}>{t.qrCode}</Text>
                  </Section>
                  {/* Ticket stub effect */}
                  <Section style={ticketStub}>
                    <Text style={ticketStubText}>TICKET {i + 1}/{ticketCount}</Text>
                  </Section>
                </Section>
              )
            })}

            {/* Warning box */}
            <Section style={warningBox}>
              <Text style={warningTitle}>⚠️ Important</Text>
              <Text style={warningText}>
                {ticketCount > 1
                  ? 'Chaque ticket est personnel et à usage unique. Chaque QR code ne peut être utilisé qu\'une seule fois.'
                  : 'Ce ticket est personnel et à usage unique. Il ne peut être utilisé qu\'une seule fois.'}
              </Text>
            </Section>
          </Section>

          {/* Footer */}
          <Hr style={divider} />
          <Section style={footerSection}>
            <Img src={LOGO_URL} alt="L'Access" width="60" height="20" style={footerLogo} />
            <Text style={footerText}>Gestion sécurisée des accès</Text>
            <Text style={footerCopy}>© {new Date().getFullYear()} {SITE_NAME}</Text>
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

// ─── Styles ───────────────────────────────────────────────

const PRIMARY = '#0f9b6e'
const PRIMARY_DARK = '#0a7a56'
const TEXT_DARK = '#1a1a2e'
const TEXT_MUTED = '#6b7280'
const TEXT_LIGHT = '#9ca3af'
const BG_LIGHT = '#f8faf9'
const BORDER = '#e8ebe9'

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
}

const container = {
  maxWidth: '520px',
  margin: '0 auto',
}

const headerSection = {
  backgroundColor: PRIMARY,
  padding: '40px 30px 30px',
  textAlign: 'center' as const,
  borderRadius: '16px 16px 0 0',
}

const logoImg = {
  margin: '0 auto 12px',
}

const headerDividerLine = {
  color: 'rgba(255,255,255,0.3)',
  fontSize: '10px',
  letterSpacing: '4px',
  margin: '0 0 16px',
}

const headerTitle = {
  color: '#ffffff',
  margin: '0',
  fontSize: '26px',
  fontWeight: '700' as const,
  letterSpacing: '0.5px',
}

const headerSubtitle = {
  color: 'rgba(255,255,255,0.85)',
  margin: '8px 0 0',
  fontSize: '15px',
  fontWeight: '400' as const,
}

const contentSection = {
  padding: '32px 30px',
  backgroundColor: '#ffffff',
}

const greeting = {
  color: TEXT_DARK,
  fontSize: '17px',
  margin: '0 0 8px',
  lineHeight: '1.5',
}

const introText = {
  color: TEXT_MUTED,
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 28px',
}

const ticketCard = {
  marginBottom: '20px',
  borderRadius: '16px',
  overflow: 'hidden' as const,
  border: `1px solid ${BORDER}`,
}

const ticketCardInner = {
  textAlign: 'center' as const,
  padding: '28px 24px 20px',
  backgroundColor: BG_LIGHT,
}

const ticketBrand = {
  fontSize: '18px',
  fontWeight: '800' as const,
  letterSpacing: '4px',
  color: PRIMARY,
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
}

const ticketDivider = {
  borderColor: BORDER,
  margin: '12px 40px',
}

const qrImage = {
  borderRadius: '12px',
  margin: '0 auto',
  border: '4px solid #ffffff',
  boxShadow: '0 2px 12px rgba(15, 155, 110, 0.12)',
}

const ticketName = {
  color: TEXT_DARK,
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '14px 0 4px',
}

const ticketDate = {
  color: TEXT_MUTED,
  fontSize: '13px',
  margin: '4px 0 0',
}

const ticketCode = {
  color: TEXT_LIGHT,
  fontSize: '10px',
  margin: '10px 0 0',
  fontFamily: '"Courier New", monospace',
  letterSpacing: '0.5px',
}

const ticketStub = {
  backgroundColor: PRIMARY,
  padding: '8px 24px',
  textAlign: 'center' as const,
}

const ticketStubText = {
  color: 'rgba(255,255,255,0.9)',
  fontSize: '11px',
  fontWeight: '600' as const,
  letterSpacing: '3px',
  margin: '0',
  textTransform: 'uppercase' as const,
}

const warningBox = {
  backgroundColor: '#fef9ec',
  border: '1px solid #f5e6b8',
  borderLeft: `4px solid #f59e0b`,
  padding: '16px 20px',
  borderRadius: '0 10px 10px 0',
  marginTop: '8px',
}

const warningTitle = {
  color: '#92400e',
  fontSize: '14px',
  margin: '0',
  fontWeight: '600' as const,
}

const warningText = {
  color: '#a16207',
  fontSize: '13px',
  margin: '6px 0 0',
  lineHeight: '1.5',
}

const divider = {
  borderColor: BORDER,
  margin: '0',
}

const footerSection = {
  padding: '24px 30px 32px',
  textAlign: 'center' as const,
  backgroundColor: BG_LIGHT,
  borderRadius: '0 0 16px 16px',
}

const footerLogo = {
  margin: '0 auto 8px',
  opacity: '0.7',
}

const footerText = {
  color: TEXT_LIGHT,
  fontSize: '12px',
  margin: '0 0 4px',
  letterSpacing: '1px',
}

const footerCopy = {
  color: TEXT_LIGHT,
  fontSize: '11px',
  margin: '0',
}
