import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Drinkeros'

interface PurchaseConfirmedProps {
  userName?: string
  productName?: string
  productType?: string
  amountFormatted?: string
  appLoginUrl?: string
  isNewAccount?: boolean
}

const PurchaseConfirmedEmail = ({
  userName,
  productName,
  productType,
  amountFormatted,
  appLoginUrl,
  isNewAccount,
}: PurchaseConfirmedProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Compra confirmada — seu acesso já está liberado</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
        </Section>
        <Section style={content}>
          <Heading style={h1}>
            Compra confirmada{userName ? `, ${userName}` : ''}! 🥂
          </Heading>
          <Text style={text}>
            Recebemos a confirmação do seu pagamento e seu acesso já está liberado
            dentro do app da {SITE_NAME}.
          </Text>

          <Section style={card}>
            {productName && (
              <Text style={cardLine}>
                <strong>Produto:</strong> {productName}
              </Text>
            )}
            {productType && (
              <Text style={cardLine}>
                <strong>Categoria:</strong> {productType}
              </Text>
            )}
            {amountFormatted && (
              <Text style={cardLine}>
                <strong>Valor pago:</strong> {amountFormatted}
              </Text>
            )}
          </Section>

          {isNewAccount && (
            <Text style={smallText}>
              Como esta foi sua primeira compra, criamos sua conta automaticamente.
              Você vai receber um e-mail separado para definir sua senha de acesso.
            </Text>
          )}

          {appLoginUrl && (
            <Section style={{ textAlign: 'center' as const, margin: '8px 0 24px' }}>
              <Button style={button} href={appLoginUrl}>
                Acessar o app
              </Button>
            </Section>
          )}

          <Text style={smallText}>
            Qualquer dúvida, é só responder este e-mail.
          </Text>
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
  component: PurchaseConfirmedEmail,
  subject: 'Compra confirmada — seu acesso já está liberado',
  displayName: 'Compra confirmada',
  previewData: {
    userName: 'Maria',
    productName: 'Curso de Mixologia',
    productType: 'Curso',
    amountFormatted: 'R$ 197,00',
    appLoginUrl: 'https://drinkeros.com/login',
    isNewAccount: true,
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
const card = { backgroundColor: '#f4f4f5', borderRadius: '8px', padding: '16px 18px', margin: '0 0 20px' }
const cardLine = { fontSize: '14px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 6px' }
const button = { backgroundColor: '#ca1958', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e4e4e7', margin: '0' }
const footer = { fontSize: '13px', color: '#6b7280', textAlign: 'center' as const, padding: '16px 32px', margin: '0' }
