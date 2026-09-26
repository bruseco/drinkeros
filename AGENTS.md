# Regras técnicas do projeto

- O modo `demo=1` do pós-compra RAND deve ficar em componente isolado e retornar antes da lógica real, garantindo zero chamadas de pagamento, banco ou tracking.