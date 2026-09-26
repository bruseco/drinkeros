# Regras técnicas do projeto

- Certificados usam a proporção intrínseca do fundo e o módulo compartilhado `certificatePdf`; prévia e PDF nunca cortam ou deformam a arte.

- O modo `demo=1` do pós-compra RAND deve ficar em componente isolado e retornar antes da lógica real, garantindo zero chamadas de pagamento, banco ou tracking.
- O rastreamento global também deve ignorar `/rand/obrigado?demo=1`, pois a demonstração nunca registra PageView nem consulta configurações de tracking.- Pós-compra RAND real: prazo de 5 min e tempo assistido são validados em post_purchase_offers pelo rand-upsell (revealed_at/offer_deadline_at); eventos via ppo_mark_event — o cliente nunca decide preço nem prazo.
- Concessão de combo pago (mercadopago-webhook) usa a RPC `grant_combo_access` (só service_role): insere cursos/módulos ausentes, renova vencidos/estornados por 1 ano, preserva ativos/vitalícios e renova o combo — porque os gatilhos de propagação só rodam em INSERT.
