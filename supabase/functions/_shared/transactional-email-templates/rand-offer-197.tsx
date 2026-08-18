import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Drinkeros'

interface RandOffer197Props {
  userName?: string
  offerUrl?: string
  previousPriceFormatted?: string
  priceFormatted?: string
  installmentsFormatted?: string
  expiresInHours?: number
}

const RandOffer197Email = ({
  userName,
  offerUrl = 'https://drinkeros.com/rand',
  previousPriceFormatted = 'R$ 197,00',
  priceFormatted = 'R$ 97,00',
  installmentsFormatted = '12x',
  expiresInHours = 48,
}: RandOffer197Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Liberamos um desconto extra no Pacote RAND só pra você</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerTitle}>{SITE_NAME}</Heading>
        </Section>
        <Section style={content}>
          <Heading style={h1}>
            {userName ? `${userName}, ` : ''}consegui um desconto extra pra você 🎁
          </Heading>
          <Text style={text}>
            Você abriu o presente e liberou o Pacote RAND por {previousPriceFormatted}.
            Como você ainda não garantiu sua vaga, liberamos um desconto adicional
            <strong> exclusivo para você</strong>.
          </Text>

          <Section style={card}>
            <Text style={oldPrice}>De {previousPriceFormatted}</Text>
            <Text style={newPrice}>{priceFormatted}</Text>
            <Text style={cardLine}>
              ou em até <strong>{installmentsFormatted} no cartão</strong>
            </Text>
          </Section>

          <Text style={text}>
            São <strong>R$ 300 de desconto</strong> no valor original: curso completo
            Clássicos &amp; Destilados + 1 ano de Sócio do Clube dos Drinkeros.
          </Text>

          <Section style={{ textAlign: 'center' as const, margin: '8px 0 24px' }}>
            <Button style={button} href={offerUrl}>
              Garantir por {priceFormatted}
            </Button>
          </Section>

          <Text style={small}>
            O desconto já vem aplicado no link acima e vale pelas próximas {expiresInHours} horas.
          </Text>

          <Hr style={hr} />
          <Text style={small}>
            Qualquer dúvida, é só responder este e-mail que a gente te ajuda.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: RandOffer197Email,
  subject: 'Seu desconto extra no Pacote RAND (R$ 197)',
  displayName: 'Pacote RAND — oferta R$197',
  previewData: {
    userName: 'Bruno',
    offerUrl: 'https://drinkeros.com/rand?c=exemplo',
    previousPriceFormatted: 'R$ 297,00',
    priceFormatted: 'R$ 197,00',
    installmentsFormatted: '12x de R$ 21,45',
    expiresInHours: 48,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f4f4f5', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { margin: '0 auto', padding: '24px 0 40px', maxWidth: '600px' }
const header = { backgroundColor: '#ca1958', borderRadius: '12px 12px 0 0', padding: '20px 24px' }
const headerTitle = { color: '#ffffff', fontSize: '22px', margin: '0', fontWeight: 700 as const }
const content = { backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px', padding: '28px 26px' }
const h1 = { color: '#18181b', fontSize: '22px', lineHeight: '1.35', margin: '0 0 16px' }
const text = { color: '#3f3f46', fontSize: '16px', lineHeight: '1.6', margin: '0 0 16px' }
const small = { color: '#71717a', fontSize: '13px', lineHeight: '1.6', margin: '0 0 8px' }
const card = {
  backgroundColor: '#fdf2f6',
  border: '1px solid #f7cede',
  borderRadius: '10px',
  padding: '18px 20px',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const oldPrice = {
  color: '#a1a1aa',
  fontSize: '15px',
  margin: '0 0 4px',
  textDecoration: 'line-through',
}
const newPrice = { color: '#ca1958', fontSize: '34px', fontWeight: 800 as const, margin: '0 0 6px' }
const cardLine = { color: '#3f3f46', fontSize: '15px', margin: '0' }
const button = {
  backgroundColor: '#ca1958',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '17px',
  fontWeight: 700 as const,
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e4e4e7', margin: '24px 0 16px' }
