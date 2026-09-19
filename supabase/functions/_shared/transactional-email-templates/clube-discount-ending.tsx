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
  endsAt?: string
}

const Email = ({ userName, appUrl = DEFAULT_APP_URL, endsAt }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu 80% OFF de sócio termina amanhã</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
          <Text style={headerSub}>Clube dos Drinkeros</Text>
        </Section>
        <Section style={content}>
          <Heading style={h1}>
            {userName ? `${userName}, seu 80% OFF termina amanhã ⏳` : 'Seu 80% OFF termina amanhã ⏳'}
          </Heading>
          <Text style={text}>
            Seus 7 dias de <strong>80% OFF</strong> em cursos e e-books
            {endsAt ? ` vão até ${endsAt}` : ' terminam amanhã'}. Depois disso, seu
            desconto de sócio continua, mas passa a ser de <strong>50% OFF</strong>.
          </Text>
          <Text style={text}>
            Se tem algum curso na sua lista, esse é o melhor momento para garantir.
          </Text>
          <Section style={{ textAlign: 'center' as const, marginTop: 24 }}>
            <Button style={button} href={appUrl}>Ver cursos com 80% OFF</Button>
          </Section>
          <Text style={smallNote}>
            Alguns cursos têm condição especial de sócio com preço fechado, diferente
            do percentual padrão.
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
const button = { backgroundColor: '#ca1958', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const smallNote = { fontSize: '13px', color: '#666666', lineHeight: '1.5', margin: '24px 0 0', textAlign: 'center' as const }
const hr = { borderColor: '#f1f1f3', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, padding: '0 32px 24px' }

export const template = {
  component: Email,
  subject: 'Seu 80% OFF de sócio termina amanhã ⏳',
  displayName: 'Clube — fim da janela de 80%',
  previewData: { userName: 'Tom', appUrl: DEFAULT_APP_URL, endsAt: '30/09/2026' },
} satisfies TemplateEntry
