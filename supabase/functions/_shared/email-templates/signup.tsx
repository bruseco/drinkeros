/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail para {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{siteName}</Heading>
        </Section>
        <Section style={content}>
          <Heading style={h1}>Confirme seu e-mail</Heading>
          <Text style={text}>Obrigado por se cadastrar na <strong>{siteName}</strong>!</Text>
          <Text style={text}>Confirme seu endereço de e-mail ({recipient}) clicando no botão abaixo:</Text>
          <Button style={button} href={confirmationUrl}>Verificar E-mail</Button>
          <Text style={footer}>Se você não criou uma conta, pode ignorar este e-mail.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#f4f4f5', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden' as const }
const header = { backgroundColor: '#ca1958', padding: '24px 32px', textAlign: 'center' as const }
const headerTitle = { color: '#ffffff', fontSize: '24px', fontWeight: 'bold' as const, margin: '0' }
const content = { padding: '32px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#ca1958', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '24px 0 0' }
