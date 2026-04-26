import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ClubeRenewalShell, text, type ClubeRenewalProps } from './_clube-renewal-shared.tsx'

const Email = ({ userName, expiresAt }: ClubeRenewalProps) => (
  <ClubeRenewalShell
    preview="Faltam 10 dias para seu Clube dos Drinkeros expirar"
    title={`${userName ? userName + ', f' : 'F'}altam 10 dias ⏳`}
    intro={
      <>
        Em 10 dias sua assinatura do <strong>Clube dos Drinkeros</strong>
        {expiresAt ? ` expira (${expiresAt})` : ' chega ao fim'}. Garanta seu acesso antes que receitas, xaropes artesanais e descontos sejam pausados.
      </>
    }
    body={<Text style={text}>É rapidinho — renove agora e nem precisa pensar nisso de novo por mais um ano.</Text>}
  />
)

export const template = {
  component: Email,
  subject: 'Faltam 10 dias para seu Clube ⏳',
  displayName: 'Clube — renovação 10 dias',
  previewData: { userName: 'Tom', expiresAt: '05/05/2026' },
} satisfies TemplateEntry
