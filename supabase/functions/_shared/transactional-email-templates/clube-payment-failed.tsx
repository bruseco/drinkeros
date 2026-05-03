import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { ClubeRenewalShell, text, type ClubeRenewalProps } from './_clube-renewal-shared.tsx'

const Email = ({ userName }: ClubeRenewalProps) => (
  <ClubeRenewalShell
    preview="Não conseguimos renovar seu Clube — atualize seu cartão"
    title={`${userName ? userName + ', t' : 'T'}ivemos um problema com seu cartão`}
    intro={
      <>
        Tentamos renovar sua assinatura do <strong>Clube dos Drinkeros</strong> e o pagamento foi recusado.
        Por isso, seu acesso foi pausado temporariamente.
      </>
    }
    body={<Text style={text}>Atualize seu cartão ou pague via Pix em segundos para liberar tudo de novo.</Text>}
    ctaLabel="Reativar meu Clube"
  />
)

export const template = {
  component: Email,
  subject: 'Sua assinatura do Clube foi pausada — atualize seu pagamento',
  displayName: 'Clube — pagamento recusado',
  previewData: { userName: 'Tom' },
} satisfies TemplateEntry
