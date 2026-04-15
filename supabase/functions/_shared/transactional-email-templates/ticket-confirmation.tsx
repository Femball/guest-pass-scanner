import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Img, Row, Column,
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
  amount?: number | null
  paymentMethod?: string | null
  paymentStatus?: string | null
}

const TicketConfirmationEmail = ({
  mainName = 'Invité',
  eventName = 'Soirée',
  eventDate = '',
  qrColor = 'c9a84c',
  tickets = [],
  amount,
  paymentMethod,
  paymentStatus,
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

            {/* Payment info */}
            {amount != null && amount > 0 && (
              <Section style={paymentBox}>
                <Text style={paymentTitle}>💰 Paiement</Text>
                <Text style={paymentAmount}>{amount.toFixed(2)} €</Text>
                <Text style={paymentDetail}>
                  {paymentMethod === 'card' ? '💳 Carte bancaire' : '💵 Espèces'}
                  {' — '}
                  {paymentStatus === 'paid' ? '✅ Payé' : paymentStatus === 'pending' ? '⏳ En attente' : '❌ Échoué'}
                </Text>
              </Section>
            )}

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
            <Text style={footerBrand}>L'ACCESS</Text>
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
    qrColor: 'c9a84c',
    amount: 50,
    paymentMethod: 'card',
    paymentStatus: 'paid',
    tickets: [
      { clientName: 'Jean Dupont', qrCode: 'TICKET-PREVIEW-001' },
      { clientName: 'Marie Dupont', qrCode: 'TICKET-PREVIEW-002' },
    ],
  },
} satisfies TemplateEntry

// ─── Styles ───────────────────────────────────────────────

const GOLD = '#c9a84c'
const GOLD_LIGHT = '#e2cc7e'
const GOLD_DARK = '#a8872e'
const BG_DARK = '#0d0d0d'
const BG_CARD = '#1a1a1a'
const BG_CARD_INNER = '#141414'
const TEXT_WHITE = '#f5f5f5'
const TEXT_MUTED = '#a0a0a0'
const TEXT_LIGHT = '#6b6b6b'
const BORDER = '#2a2a2a'

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
}

const container = {
  maxWidth: '520px',
  margin: '0 auto',
}

const headerSection = {
  backgroundColor: BG_DARK,
  padding: '40px 30px 32px',
  textAlign: 'center' as const,
  borderRadius: '16px 16px 0 0',
  borderBottom: `2px solid ${GOLD}`,
}

const headerBrand = {
  color: GOLD,
  fontSize: '30px',
  fontWeight: '800' as const,
  letterSpacing: '8px',
  margin: '0 0 16px',
  textTransform: 'uppercase' as const,
  fontFamily: 'Georgia, "Times New Roman", serif',
}

const headerTitle = {
  color: TEXT_WHITE,
  margin: '0',
  fontSize: '24px',
  fontWeight: '700' as const,
  letterSpacing: '1px',
}

const headerSubtitle = {
  color: TEXT_MUTED,
  margin: '10px 0 0',
  fontSize: '14px',
  fontWeight: '400' as const,
  letterSpacing: '0.5px',
}

const contentSection = {
  padding: '32px 30px',
  backgroundColor: BG_CARD,
}

const greeting = {
  color: TEXT_WHITE,
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
  boxShadow: `0 0 20px rgba(201, 168, 76, 0.08)`,
}

const ticketCardInner = {
  textAlign: 'center' as const,
  padding: '28px 24px 20px',
  backgroundColor: BG_CARD_INNER,
}

const ticketBrand = {
  fontSize: '16px',
  fontWeight: '800' as const,
  letterSpacing: '5px',
  color: GOLD,
  margin: '0 0 4px',
  textTransform: 'uppercase' as const,
  fontFamily: 'Georgia, "Times New Roman", serif',
}

const ticketDivider = {
  borderColor: BORDER,
  margin: '12px 40px',
}

const qrImage = {
  borderRadius: '12px',
  margin: '0 auto',
  border: `3px solid ${GOLD}`,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
}

const ticketName = {
  color: TEXT_WHITE,
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '14px 0 4px',
}

const ticketDate = {
  color: GOLD_LIGHT,
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
  backgroundColor: GOLD_DARK,
  padding: '8px 24px',
  textAlign: 'center' as const,
}

const ticketStubText = {
  color: '#0d0d0d',
  fontSize: '11px',
  fontWeight: '700' as const,
  letterSpacing: '3px',
  margin: '0',
  textTransform: 'uppercase' as const,
}

const warningBox = {
  backgroundColor: '#1c1a12',
  border: `1px solid ${GOLD_DARK}`,
  borderLeft: `4px solid ${GOLD}`,
  padding: '16px 20px',
  borderRadius: '0 10px 10px 0',
  marginTop: '8px',
}

const warningTitle = {
  color: GOLD,
  fontSize: '14px',
  margin: '0',
  fontWeight: '600' as const,
}

const warningText = {
  color: GOLD_LIGHT,
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
  backgroundColor: BG_DARK,
  borderRadius: '0 0 16px 16px',
  borderTop: `1px solid ${BORDER}`,
}

const footerBrand = {
  color: GOLD,
  fontSize: '14px',
  fontWeight: '700' as const,
  letterSpacing: '3px',
  margin: '0 0 4px',
  fontFamily: 'Georgia, "Times New Roman", serif',
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

const paymentBox = {
  backgroundColor: '#1a1c14',
  border: `1px solid ${BORDER}`,
  borderLeft: `4px solid ${GOLD}`,
  padding: '16px 20px',
  borderRadius: '0 10px 10px 0',
  marginBottom: '16px',
  textAlign: 'center' as const,
}

const paymentTitle = {
  color: GOLD,
  fontSize: '14px',
  margin: '0 0 4px',
  fontWeight: '600' as const,
}

const paymentAmount = {
  color: TEXT_WHITE,
  fontSize: '24px',
  fontWeight: '700' as const,
  margin: '4px 0',
}

const paymentDetail = {
  color: TEXT_MUTED,
  fontSize: '13px',
  margin: '4px 0 0',
}
