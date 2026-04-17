/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre code de vérification L'Access</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>L'ACCESS</Text></Section>
        <Section style={content}>
          <Heading style={h1}>Confirmer votre identité</Heading>
          <Text style={text}>Utilisez le code ci-dessous pour confirmer votre identité :</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            Ce code expirera prochainement. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </Text>
        </Section>
        <Section style={footerSection}>
          <Text style={footerBrand}>L'ACCESS</Text>
          <Text style={footerCopy}>Gestion sécurisée des accès</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const GOLD = '#c9a84c'
const BG_DARK = '#0d0d0d'
const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }
const container = { maxWidth: '520px', margin: '0 auto' }
const header = { backgroundColor: BG_DARK, padding: '32px 30px', textAlign: 'center' as const, borderRadius: '16px 16px 0 0', borderBottom: `2px solid ${GOLD}` }
const brand = { color: GOLD, fontSize: '28px', fontWeight: '800' as const, letterSpacing: '8px', margin: '0', fontFamily: 'Georgia, "Times New Roman", serif' }
const content = { padding: '32px 30px', backgroundColor: '#1a1a1a', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#f5f5f5', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#a0a0a0', lineHeight: '1.6', margin: '0 0 16px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: GOLD,
  letterSpacing: '6px',
  margin: '20px 0 30px',
  padding: '16px',
  backgroundColor: '#0d0d0d',
  borderRadius: '10px',
  border: `1px solid ${GOLD}`,
}
const footer = { fontSize: '12px', color: '#6b6b6b', margin: '20px 0 0', lineHeight: '1.5' }
const footerSection = { padding: '24px 30px', textAlign: 'center' as const, backgroundColor: BG_DARK, borderRadius: '0 0 16px 16px' }
const footerBrand = { color: GOLD, fontSize: '14px', fontWeight: '700' as const, letterSpacing: '3px', margin: '0 0 4px', fontFamily: 'Georgia, "Times New Roman", serif' }
const footerCopy = { color: '#6b6b6b', fontSize: '11px', margin: '0' }
