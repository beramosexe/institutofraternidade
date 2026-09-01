# Registrar compra pela foto da nota fiscal

Novo fluxo em Compras: fotografar (ou enviar) a nota, a IA lê os dados, categoriza os itens automaticamente e abre uma aba de conferência para o usuário corrigir antes de salvar.

## Como vai funcionar

1. Em `/app/compras`, o botão "Registrar compra" abre um diálogo com duas abas:
   - **Nota fiscal (IA)** — captura direto da câmera no celular ou envio de arquivo (foto/PDF).
   - **Manual** — o formulário atual, sem mudanças.
2. Ao enviar a imagem: barra de progresso "Lendo a nota...". O arquivo vai para o espaço privado de documentos.
3. A IA devolve fornecedor, data da compra, itens (nome, unidade, quantidade, valor unitário) e total, e sugere para cada item:
   - a **categoria** (usando as categorias já existentes no estoque);
   - o **vínculo com um produto do estoque** quando houver correspondência de nome.
4. O diálogo salta para a aba **Conferência**, já preenchida, com:
   - campos editáveis para fornecedor, data, observações;
   - tabela de itens com categoria, vínculo de estoque, quantidade e valor — tudo corrigível, com adicionar/remover linha;
   - aviso quando a soma dos itens não fecha com o total lido da nota;
   - marcação visual nos campos que vieram da IA e ainda não foram confirmados;
   - miniatura da nota ao lado, ampliável, para comparar.
5. Confirmando, a compra é criada como hoje (com entrada automática no estoque para itens vinculados) e a foto da nota fica anexada à compra.
6. Se a leitura falhar (foto ilegível, sem créditos de IA, etc.), aparece a mensagem do erro e o botão para tentar de novo ou seguir no modo manual.

Itens sem correspondência no estoque podem ser criados como novo produto na hora da conferência, já com a categoria sugerida.

## Detalhes técnicos

- **Upload**: cliente envia para o bucket privado `documentos` em `notas/<user_id>/<uuid>.<ext>`; nenhuma URL pública é gerada.
- **Nova server function** `parseInvoice` em `src/lib/purchases.functions.ts` (`requireSupabaseAuth`):
  - gera URL assinada do arquivo, chama o Lovable AI Gateway (`/v1/chat/completions`, `google/gemini-3.7-flash`) com bloco `image_url` para imagens e bloco `file` para PDF, `response_format: json_object`;
  - prompt em pt-BR pedindo `{supplier, purchased_on, total, items:[{name, unit, quantity, unit_price, category}]}`, proibindo inventar valores (campos desconhecidos vêm nulos);
  - recebe a lista de produtos e categorias do estoque para orientar a categorização; casamento de nome feito no servidor (normalização + similaridade) devolvendo `item_id` sugerido e `match_confidence`;
  - valida a resposta com Zod; trata 402/403/429/5xx conforme o contrato do gateway, com mensagens em português (sem retry automático em erro terminal).
- **Reuso**: `createPurchase` e `addPurchaseDocument` já existentes; a nota é anexada com `kind: "nota"` e `ai_suggestion` guardando o JSON bruto da leitura.
- **UI**: o diálogo de `src/routes/_authenticated/app.compras.tsx` passa a usar `Tabs`; o formulário de linhas atual é extraído para um componente reutilizável entre "Manual" e "Conferência", com a coluna extra de categoria. Input de câmera via `<input type="file" accept="image/*" capture="environment">`.
- Nenhuma mudança de banco de dados é necessária.
