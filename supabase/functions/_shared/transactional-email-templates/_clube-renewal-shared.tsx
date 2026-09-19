/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'

export const SITE_NAME = "Drinkeros"
export const RENEW_URL = "https://drinkeros.com/clube?renovar=1"

export interface ClubeRenewalProps {
  userName?: string
  daysLeft?: number
  expiresAt?: string
  couponCode?: string
}

interface ShellProps {
  preview: string
  title: string
  intro: React.ReactNode
  body?: React.ReactNode
  ctaLabel?: string
  ctaUrl?: string
}

export const ClubeRenewalShell = ({ preview, title, intro, body, ctaLabel = 'Renovar Clube dos Drinkeros', ctaUrl = RENEW_URL }: ShellProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
          <Text style={headerSub}>Clube dos Drinkeros</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>{intro}</Text>
          {body}
          <Section style={{ textAlign: 'center' as const, marginTop: 24 }}>
            <Button style={button} href={ctaUrl}>{ctaLabel}</Button>
          </Section>
          <Text style={smallNote}>
            Renove em segundos para continuar com receitas exclusivas, xaropes artesanais, seu desconto de sócio nos cursos e a comunidade do Clube.
          </Text>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} — O mundo dos drinks é aqui.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
export const container = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden' as const, border: '1px solid #f1f1f3' }
export const header = { backgroundColor: '#ca1958', padding: '24px 32px', textAlign: 'center' as const }
export const headerTitle = { color: '#ffffff', fontSize: '24px', fontWeight: 'bold' as const, margin: '0' }
export const headerSub = { color: '#ffffff', fontSize: '13px', margin: '4px 0 0', opacity: 0.85 }
export const content = { padding: '32px' }
export const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
export const text = { fontSize: '15px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 16px' }
export const smallNote = { fontSize: '13px', color: '#666666', lineHeight: '1.5', margin: '24px 0 0', textAlign: 'center' as const }
export const button = { backgroundColor: '#ca1958', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
export const hr = { borderColor: '#f1f1f3', margin: '24px 0 16px' }
export const footer = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, padding: '0 32px 24px' }
export const couponBox = {
  backgroundColor: '#fff5f9',
  border: '2px dashed #ca1958',
  borderRadius: '10px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '20px 0',
}
export const couponCodeStyle = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#ca1958',
  letterSpacing: '2px',
  margin: '8px 0',
}
