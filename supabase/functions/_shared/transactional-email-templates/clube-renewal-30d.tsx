import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ClubeRenewalShell, text, type ClubeRenewalProps } from './_clube-renewal-shared.tsx'

const Email = ({ userName, expiresAt }: ClubeRenewalProps) => (
  <ClubeRenewalShell
    preview="Seu Clube dos Drinkeros vence em 30 dias"
    title={`${userName ? userName + ', s' : 'S'}eu Clube vence em 30 dias 🗓️`}
    intro={
      <>
        Faltam 30 dias para sua assinatura do <strong>Clube dos Drinkeros</strong> expirar
        {expiresAt ? ` (${expiresAt})` : ''}. Renove agora e continue com tudo que você ama: receitas exclusivas, xaropes, descontos especiais e a comunidade.
      </>
    }
    body={
      <Text style={text}>
        Renove com tranquilidade — sem perder nenhum dia de acesso.
      </Text>
    }
  />
)

export const template = {
  component: Email,
  subject: 'Seu Clube dos Drinkeros vence em 30 dias 🗓️',
  displayName: 'Clube — renovação 30 dias',
  previewData: { userName: 'Tom', expiresAt: '15/05/2026' },
} satisfies TemplateEntry
