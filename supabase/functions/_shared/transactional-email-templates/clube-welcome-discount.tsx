/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Drinkeros'
const DEFAULT_APP_URL = 'https://drinkeros.com/app/cursos'

interface Props {
  userName?: string
  appUrl?: string
}

const Email = ({ userName, appUrl = DEFAULT_APP_URL }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu benefício de Sócio: 80% OFF nos 7 primeiros dias de uso</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
          <Text style={headerSub}>Clube dos Drinkeros</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>
            {userName ? `${userName}, bem-vindo ao Clube! 🥂` : 'Bem-vindo ao Clube! 🥂'}
          </Heading>
          <Text style={text}>
            Além das receitas exclusivas, xaropes artesanais e da comunidade, você
            ganhou um benefício de sócio nos cursos e e-books da {SITE_NAME}.
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>80% OFF nos 7 primeiros dias</Text>
            <Text style={cardLine}>
              A contagem começa no seu <strong>primeiro acesso ao app</strong> — ou
              seja, o relógio só corre depois que você entrar. Dentro do app você vê
              exatamente quanto tempo falta.
            </Text>
            <Text style={cardLine}>
              Passados esses 7 dias, seu desconto de sócio continua para sempre em{' '}
              <strong>50% OFF</strong>.
            </Text>
          </Section>

          <Section style={{ textAlign: 'center' as const, marginTop: 24 }}>
            <Button style={button} href={appUrl}>Entrar no app e ativar meus 7 dias</Button>
          </Section>

          <Text style={smallNote}>
            Alguns cursos têm condição especial de sócio com preço fechado, diferente
            do percentual padrão. O valor com seu desconto sempre aparece na página do
            curso antes de você pagar.
          </Text>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>{SITE_NAME} — O mundo dos drinks é aqui.</Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#f4f4f5', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden' as const, border: '1px solid #f1f1f3' }
const header = { backgroundColor: '#ca1958', padding: '24px 32px', textAlign: 'center' as const }
const headerTitle = { color: '#ffffff', fontSize: '24px', fontWeight: 'bold' as const, margin: '0' }
const headerSub = { color: '#ffffff', fontSize: '13px', margin: '4px 0 0', opacity: 0.85 }
const content = { padding: '32px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#fff5f9', border: '1px solid #f6d6e3', borderRadius: '10px', padding: '20px', margin: '8px 0 0' }
const cardTitle = { fontSize: '18px', fontWeight: 'bold' as const, color: '#ca1958', margin: '0 0 10px' }
const cardLine = { fontSize: '14px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 8px' }
const button = { backgroundColor: '#ca1958', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const smallNote = { fontSize: '13px', color: '#666666', lineHeight: '1.5', margin: '24px 0 0', textAlign: 'center' as const }
const hr = { borderColor: '#f1f1f3', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, padding: '0 32px 24px' }

export const template = {
  component: Email,
  subject: 'Seu benefício de Sócio: 80% OFF nos 7 primeiros dias 🥂',
  displayName: 'Clube — boas-vindas (desconto 80%)',
  previewData: { userName: 'Tom', appUrl: DEFAULT_APP_URL },
} satisfies TemplateEntry
