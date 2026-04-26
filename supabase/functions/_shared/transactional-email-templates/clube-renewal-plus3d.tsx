import * as React from 'npm:react@18.3.1'
import { Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ClubeRenewalShell, text, couponBox, couponCodeStyle, RENEW_URL, type ClubeRenewalProps } from './_clube-renewal-shared.tsx'

const Email = ({ userName, couponCode }: ClubeRenewalProps) => (
  <ClubeRenewalShell
    preview="Volta pro Clube com R$10 OFF — só pra você"
    title={`${userName ? userName + ', q' : 'Q'}ue tal voltar com R$10 OFF? 🎁`}
    intro={
      <>
        Faz 3 dias que sua assinatura do <strong>Clube dos Drinkeros</strong> expirou. A gente sente sua falta — então separamos um cupom exclusivo de
        {' '}<strong>R$10 de desconto</strong> pra você voltar.
      </>
    }
    body={
      <Section style={couponBox}>
        <Text style={{ ...text, margin: '0 0 4px', color: '#666' }}>Use no checkout:</Text>
        <Text style={couponCodeStyle}>{couponCode || 'VOLTA-XXXXXX'}</Text>
        <Text style={{ ...text, margin: '4px 0 0', fontSize: '12px', color: '#666' }}>Válido por 14 dias · Uso único</Text>
      </Section>
    }
    ctaLabel="Renovar com R$10 OFF"
    ctaUrl={RENEW_URL}
  />
)

export const template = {
  component: Email,
  subject: 'Volta pro Clube com R$10 OFF 🎁',
  displayName: 'Clube — recuperação +3 dias com cupom',
  previewData: { userName: 'Tom', couponCode: 'VOLTA-AB12CD' },
} satisfies TemplateEntry
