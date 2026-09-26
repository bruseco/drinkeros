# Regras técnicas do projeto

- O modo `demo=1` do pós-compra RAND deve ficar em componente isolado e retornar antes da lógica real, garantindo zero chamadas de pagamento, banco ou tracking.
- O rastreamento global também deve ignorar `/rand/obrigado?demo=1`, pois a demonstração nunca registra PageView nem consulta configurações de tracking.