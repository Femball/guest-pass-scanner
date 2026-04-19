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

interface ReminderProps {
  mainName?: string
  eventDate?: string
  eventTime?: string
  eventAddress?: string
  qrColor?: string
  tickets?: Ticket[]
}

const ReminderDayBeforeEmail = ({
  mainName = 'Invité',
  eventDate = '',
  eventTime,
  eventAddress,
  qrColor = 'c9a84c',
  tickets = [],
}: ReminderProps) => {
  const ticketCount = tickets.length || 1

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Rappel — votre soirée {SITE_NAME} c'est demain</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>C'est demain, {mainName} !</Heading>
          <Text style={text}>
            Petit rappel amical : vous êtes attendu(e) demain à notre soirée {SITE_NAME}.
            Voici {ticketCount > 1 ? `vos ${ticketCount} QR codes` : 'votre QR code'} pour l'entrée.
          </Text>

          <Section style={infoBox}>
            <Text style={infoLabel}>📅 Date</Text>
            <Text style={infoValue}>{eventDate}</Text>
            {eventTime && (
              <>
                <Text style={infoLabel}>🕐 Heure</Text>
                <Text style={infoValue}>{eventTime}</Text>
              </>
            )}
            {eventAddress && (
              <>
                <Text style={infoLabel}>📍 Adresse</Text>
                <Text style={infoValue}>{eventAddress}</Text>
              </>
            )}
          </Section>

          <Hr style={hr} />

          {tickets.map((ticket, idx) => (
            <Section key={idx} style={ticketBox}>
              <Text style={ticketName}>🎫 {ticket.clientName}</Text>
              <Img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(ticket.qrCode)}&color=${qrColor}&bgcolor=ffffff&margin=10`}
                alt="QR Code"
                width="240"
                height="240"
                style={qrImage}
              />
              <Text style={ticketCode}>{ticket.qrCode}</Text>
            </Section>
          ))}

          <Hr style={hr} />

          <Text style={footer}>
            À très vite,<br />
            L'équipe {SITE_NAME}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReminderDayBeforeEmail,
  subject: `Rappel — votre soirée ${SITE_NAME} c'est demain 🎉`,
  displayName: 'Rappel J-1',
  previewData: {
    mainName: 'Sophie',
    eventDate: 'samedi 20 avril 2026',
    eventTime: '20:00',
    eventAddress: '12 rue de la Soirée, Paris',
    tickets: [{ clientName: 'Sophie Martin', qrCode: 'TICKET-DEMO-1234' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px' }
const h1 = { fontSize: '24px', fontWeight: 'bold', color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 20px' }
const infoBox = { backgroundColor: '#f8f5ed', padding: '20px', borderRadius: '8px', margin: '20px 0' }
const infoLabel = { fontSize: '12px', color: '#888888', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const infoValue = { fontSize: '16px', color: '#000000', margin: '0 0 12px', fontWeight: '600' }
const hr = { borderColor: '#e6e6e6', margin: '24px 0' }
const ticketBox = { textAlign: 'center' as const, padding: '20px 0' }
const ticketName = { fontSize: '16px', fontWeight: '600', color: '#000000', margin: '0 0 12px' }
const qrImage = { margin: '0 auto', display: 'block' }
const ticketCode = { fontSize: '11px', color: '#999999', fontFamily: 'monospace', margin: '8px 0 0' }
const footer = { fontSize: '13px', color: '#666666', margin: '20px 0 0', textAlign: 'center' as const }
