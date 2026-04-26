import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ClubeRenewalShell, text, type ClubeRenewalProps } from './_clube-renewal-shared.tsx'

const Email = ({ userName, expiresAt }: ClubeRenewalProps) => (
  <ClubeRenewalShell
    preview="Amanhã seu Clube dos Drinkeros expira"
    title={`${userName ? userName + ', a' : 'A'}manhã é o último dia`}
    intro={
      <>
        Sua assinatura do <strong>Clube dos Drinkeros</strong> expira amanhã
        {expiresAt ? ` (${expiresAt})` : ''}. Renove agora pra não perder o acesso às receitas exclusivas, xaropes e à comunidade.
      </>
    }
    body={<Text style={text}>Demora 30 segundos.</Text>}
  />
)

export const template = {
  component: Email,
  subject: 'Amanhã é o último dia do seu Clube',
  displayName: 'Clube — renovação 1 dia',
  previewData: { userName: 'Tom', expiresAt: '26/04/2026' },
} satisfies TemplateEntry
