import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ClubeRenewalShell, text, type ClubeRenewalProps } from './_clube-renewal-shared.tsx'

const Email = ({ userName }: ClubeRenewalProps) => (
  <ClubeRenewalShell
    preview="Seu Clube dos Drinkeros vence hoje"
    title={`${userName ? userName + ', s' : 'S'}eu Clube vence hoje 🥃`}
    intro={
      <>
        Hoje é o último dia da sua assinatura do <strong>Clube dos Drinkeros</strong>. Renove agora e a continuidade é instantânea — sem perder nada.
      </>
    }
    body={<Text style={text}>A gente te espera lá dentro.</Text>}
  />
)

export const template = {
  component: Email,
  subject: 'Seu Clube vence HOJE 🥃',
  displayName: 'Clube — vence hoje',
  previewData: { userName: 'Tom' },
} satisfies TemplateEntry
