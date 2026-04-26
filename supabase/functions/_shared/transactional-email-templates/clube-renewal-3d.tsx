import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ClubeRenewalShell, text, type ClubeRenewalProps } from './_clube-renewal-shared.tsx'

const Email = ({ userName, expiresAt }: ClubeRenewalProps) => (
  <ClubeRenewalShell
    preview="3 dias para seu Clube dos Drinkeros expirar"
    title={`${userName ? userName + ', s' : 'S'}eu Clube expira em 3 dias`}
    intro={
      <>
        Estamos no fio do bigode 🥃. Em 3 dias sua assinatura do <strong>Clube dos Drinkeros</strong>
        {expiresAt ? ` vence (${expiresAt})` : ' vence'}. Renove para não ter interrupção no acesso.
      </>
    }
    body={<Text style={text}>Um clique resolve.</Text>}
  />
)

export const template = {
  component: Email,
  subject: '3 dias para seu Clube vencer',
  displayName: 'Clube — renovação 3 dias',
  previewData: { userName: 'Tom', expiresAt: '28/04/2026' },
} satisfies TemplateEntry
