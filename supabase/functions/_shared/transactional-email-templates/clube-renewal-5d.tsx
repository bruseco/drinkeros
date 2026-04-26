import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ClubeRenewalShell, text, type ClubeRenewalProps } from './_clube-renewal-shared.tsx'

const Email = ({ userName, expiresAt }: ClubeRenewalProps) => (
  <ClubeRenewalShell
    preview="5 dias para seu Clube dos Drinkeros expirar"
    title={`${userName ? userName + ', f' : 'F'}altam só 5 dias 🚨`}
    intro={
      <>
        Sua assinatura do <strong>Clube dos Drinkeros</strong>
        {expiresAt ? ` expira em ${expiresAt}` : ' está perto de expirar'}. Não deixe pra última hora — renove agora.
      </>
    }
    body={<Text style={text}>Mantém o acesso a tudo: receitas exclusivas, xaropes artesanais e 80% OFF em todos os cursos.</Text>}
  />
)

export const template = {
  component: Email,
  subject: 'Faltam só 5 dias 🚨',
  displayName: 'Clube — renovação 5 dias',
  previewData: { userName: 'Tom', expiresAt: '30/04/2026' },
} satisfies TemplateEntry
