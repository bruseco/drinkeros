import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Drinkeros'

interface AccountCreatedProps {
  userName?: string
  email?: string
  productName?: string
  passwordSetupUrl?: string
  appUrl?: string
}

const AccountCreatedEmail = ({
  userName,
  email,
  productName,
  passwordSetupUrl,
  appUrl,
}: AccountCreatedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua conta {SITE_NAME} foi criada — defina sua senha</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
        </Section>
        <Section style={content}>
          <Heading style={h1}>
            Bem-vindo(a){userName ? `, ${userName}` : ''}! 🎉
          </Heading>
          <Text style={text}>
            Sua conta na {SITE_NAME} foi criada automaticamente após a confirmação
            {productName ? ` da compra de ${productName}` : ' da sua compra'}.
          </Text>
          {email && (
            <Text style={credentialText}>
              <strong>Seu e-mail de acesso:</strong> {email}
            </Text>
          )}
          <Text style={text}>
            Para começar, defina sua senha clicando no botão abaixo:
          </Text>
          {passwordSetupUrl && (
            <Section style={{ textAlign: 'center' as const, margin: '8px 0 24px' }}>
              <Button style={button} href={passwordSetupUrl}>
                Definir minha senha
              </Button>
            </Section>
          )}
          <Text style={smallText}>
            Esse link é pessoal e expira em algumas horas. Se precisar, você
            pode pedir um novo link na tela de login do app.
          </Text>
          {appUrl && (
            <Text style={smallText}>
              Depois de definir a senha, acesse o app em:{' '}
              <a href={appUrl} style={link}>{appUrl}</a>
            </Text>
          )}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} — Sua plataforma de drinks e coquetelaria
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccountCreatedEmail,
  subject: 'Sua conta Drinkeros foi criada — defina sua senha',
  displayName: 'Conta criada após compra',
  previewData: {
    userName: 'Maria',
    email: 'maria@exemplo.com',
    productName: 'Curso de Mixologia',
    passwordSetupUrl: 'https://drinkeros.com/reset-password?token=exemplo',
    appUrl: 'https://drinkeros.com/login',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f4f4f5', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden' as const }
const header = { backgroundColor: '#ca1958', padding: '24px 32px', textAlign: 'center' as const }
const headerTitle = { color: '#ffffff', fontSize: '24px', fontWeight: 'bold' as const, margin: '0' }
const content = { padding: '32px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 16px' }
const smallText = { fontSize: '13px', color: '#52525b', lineHeight: '1.6', margin: '0 0 12px' }
const credentialText = { fontSize: '15px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 16px', backgroundColor: '#f4f4f5', padding: '10px 14px', borderRadius: '6px' }
const button = { backgroundColor: '#ca1958', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const link = { color: '#ca1958', textDecoration: 'underline' }
const hr = { borderColor: '#e4e4e7', margin: '0' }
const footer = { fontSize: '13px', color: '#6b7280', textAlign: 'center' as const, padding: '16px 32px', margin: '0' }
