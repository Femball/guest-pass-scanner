/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const BRAND = "L'Access"

export const SignupEmail = ({ siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Confirmez votre adresse email pour {BRAND}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}><Text style={brand}>L'ACCESS</Text></Section>
        <Section style={content}>
          <Heading style={h1}>Confirmez votre email</Heading>
          <Text style={text}>
            Merci de votre inscription sur{' '}
            <Link href={siteUrl} style={link}><strong>{BRAND}</strong></Link>.
          </Text>
          <Text style={text}>
            Veuillez confirmer votre adresse{' '}
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>{' '}
            en cliquant sur le bouton ci-dessous :
          </Text>
          <Section style={btnWrap}>
            <Button style={button} href={confirmationUrl}>Confirmer mon email</Button>
          </Section>
          <Text style={footer}>
            Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email.
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

export default SignupEmail

const GOLD = '#c9a84c'
const BG_DARK = '#0d0d0d'
const main = { backgroundColor: '#ffffff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }
const container = { maxWidth: '520px', margin: '0 auto' }
const header = { backgroundColor: BG_DARK, padding: '32px 30px', textAlign: 'center' as const, borderRadius: '16px 16px 0 0', borderBottom: `2px solid ${GOLD}` }
const brand = { color: GOLD, fontSize: '28px', fontWeight: '800' as const, letterSpacing: '8px', margin: '0', fontFamily: 'Georgia, "Times New Roman", serif' }
const content = { padding: '32px 30px', backgroundColor: '#1a1a1a' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#f5f5f5', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#a0a0a0', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: GOLD, textDecoration: 'underline' }
const btnWrap = { textAlign: 'center' as const, margin: '30px 0' }
const button = { backgroundColor: GOLD, color: '#0d0d0d', fontSize: '15px', fontWeight: '700' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', letterSpacing: '0.5px' }
const footer = { fontSize: '12px', color: '#6b6b6b', margin: '30px 0 0', lineHeight: '1.5' }
const footerSection = { padding: '24px 30px', textAlign: 'center' as const, backgroundColor: BG_DARK, borderRadius: '0 0 16px 16px' }
const footerBrand = { color: GOLD, fontSize: '14px', fontWeight: '700' as const, letterSpacing: '3px', margin: '0 0 4px', fontFamily: 'Georgia, "Times New Roman", serif' }
const footerCopy = { color: '#6b6b6b', fontSize: '11px', margin: '0' }
