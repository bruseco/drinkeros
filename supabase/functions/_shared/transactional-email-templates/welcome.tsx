import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Drinkeros"

interface WelcomeEmailProps {
  userName?: string
  email?: string
  password?: string
  loginUrl?: string
}

const WelcomeEmail = ({ userName, email, password, loginUrl }: WelcomeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Bem-vindo(a) à {SITE_NAME}! Seu acesso está pronto.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
        </Section>
        <Section style={content}>
          <Heading style={h1}>
            Bem-vindo(a), {userName || 'aluno(a)'}! 🎉
          </Heading>
          <Text style={text}>
            Sua conta na {SITE_NAME} foi criada com sucesso. Aqui estão seus dados de acesso:
          </Text>
          {email && (
            <Text style={credentialText}>
              <strong>Email:</strong> {email}
            </Text>
          )}
          {password && (
            <Text style={credentialText}>
              <strong>Senha temporária:</strong> {password}
            </Text>
          )}
          <Text style={text}>
            Recomendamos que altere sua senha após o primeiro acesso.
          </Text>
          {loginUrl && (
            <Button style={button} href={loginUrl}>
              Acessar minha conta
            </Button>
          )}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          {SITE_NAME} — Sua plataforma de drinks e cocktails
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Bem-vindo(a)! Seu acesso está pronto 🎉',
  displayName: 'E-mail de boas-vindas',
  previewData: {
    userName: 'Maria',
    email: 'maria@exemplo.com',
    password: 'abc123xyz',
    loginUrl: 'https://drinkeros.com/login',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f4f4f5', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden' as const }
const header = { backgroundColor: '#ca1958', padding: '24px 32px', textAlign: 'center' as const }
const headerTitle = { color: '#ffffff', fontSize: '24px', fontWeight: 'bold' as const, margin: '0' }
const content = { padding: '32px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 16px' }
const credentialText = { fontSize: '15px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 8px', backgroundColor: '#f4f4f5', padding: '8px 12px', borderRadius: '6px' }
const button = { backgroundColor: '#ca1958', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }
const hr = { borderColor: '#e4e4e7', margin: '0' }
const footer = { fontSize: '13px', color: '#6b7280', textAlign: 'center' as const, padding: '16px 32px', margin: '0' }
