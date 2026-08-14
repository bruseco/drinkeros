import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Drinkeros'

interface PixPaymentPendingProps {
  userName?: string
  productName?: string
  amountFormatted?: string
  pixCode?: string
  ticketUrl?: string
}

const PixPaymentPendingEmail = ({
  userName,
  productName,
  amountFormatted,
  pixCode,
  ticketUrl,
}: PixPaymentPendingProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código Pix para concluir a compra</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
        </Section>
        <Section style={content}>
          <Heading style={h1}>
            Seu código Pix está aqui{userName ? `, ${userName}` : ''} 🍹
          </Heading>
          <Text style={text}>
            Falta só o pagamento para liberar seu acesso. Copie o código Pix abaixo
            e cole no aplicativo do seu banco (Pix copia e cola).
          </Text>

          <Section style={card}>
            {productName && (
              <Text style={cardLine}><strong>Produto:</strong> {productName}</Text>
            )}
            {amountFormatted && (
              <Text style={cardLine}><strong>Valor:</strong> {amountFormatted}</Text>
            )}
          </Section>

          {pixCode && (
            <Section style={codeBox}>
              <Text style={codeText}>{pixCode}</Text>
            </Section>
          )}

          {ticketUrl && (
            <Section style={{ textAlign: 'center' as const, margin: '8px 0 24px' }}>
              <Button style={button} href={ticketUrl}>
                Abrir Pix / ver QR Code
              </Button>
            </Section>
          )}

          <Text style={smallText}>
            Assim que o pagamento for confirmado, seu acesso é liberado automaticamente
            e você recebe um e-mail de confirmação. O código Pix expira em cerca de 30 minutos.
          </Text>
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
  component: PixPaymentPendingEmail,
  subject: 'Seu código Pix — conclua sua compra',
  displayName: 'Pix gerado (código de pagamento)',
  previewData: {
    userName: 'Bruno',
    productName: 'Curso de Mixologia',
    amountFormatted: 'R$ 197,00',
    pixCode: '00020126580014br.gov.bcb.pix0136exemplo-de-chave-pix5204000053039865802BR',
    ticketUrl: 'https://www.mercadopago.com.br/payments/123/ticket',
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
const codeBox = { backgroundColor: '#f4f4f5', border: '1px solid #e4e4e7', borderRadius: '8px', padding: '14px 16px', margin: '0 0 20px' }
const codeText = { fontSize: '12px', color: '#1a1a1a', lineHeight: '1.6', margin: '0', wordBreak: 'break-all' as const, fontFamily: 'monospace' }
const button = { backgroundColor: '#ca1958', color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e4e4e7', margin: '0' }
const footer = { fontSize: '13px', color: '#6b7280', textAlign: 'center' as const, padding: '16px 32px', margin: '0' }
