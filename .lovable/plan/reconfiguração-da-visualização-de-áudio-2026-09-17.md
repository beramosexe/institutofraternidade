# Reconfiguração da visualização de áudio

Reorganizar a página de cada áudio para que ouvir, acompanhar a transcrição e encontrar as informações principais seja simples, sem alterar dados, permissões ou processamento.

## Mudanças

- **Topo mais objetivo:** manter voltar, título, trabalho, data e disponibilidade; mover estados técnicos e ações administrativas para uma área secundária e compacta.
- **Player como elemento principal:** posicionar a reprodução imediatamente após o título, com progresso, tempo, voltar/avançar e velocidade em uma barra estável e mais compacta no celular.
- **Conteúdo em ordem de uso:** exibir transcrição sincronizada como área principal e resumo/palavras-chave como apoio; no desktop, usar duas colunas quando houver espaço, sem duplicar o player.
- **Transcrição mais útil:** substituir o seletor confuso “Oculta/Parcial/Completa” por uma ação simples de expandir/recolher, manter o trecho atual evidente e permitir tocar a partir de qualquer trecho.
- **Ações de gestão separadas:** ajuste de texto/tempos, destaque, novo resumo e nova transcrição ficam agrupados e aparecem apenas para quem possui permissão.
- **Estados claros:** melhorar carregamento, processamento, erro e ausência de transcrição para sempre indicar o que está disponível e qual ação pode ser feita.
- **Mobile:** reduzir margens e altura dos controles, evitar elementos concorrendo com o menu superior e manter reprodução acessível sem esconder o conteúdo.

## Verificação

- Conferir a página autenticada em tamanhos desktop e mobile.
- Testar reprodução, busca por trecho, expansão da transcrição e entrada/saída do modo de revisão.
- Confirmar que a página não apresenta erros e que os demais usos do player continuam funcionando.

## Detalhes técnicos

- Ajustar `src/routes/_authenticated/app.audios.$id.tsx` e `src/components/app/SyncedTranscript.tsx`.
- Reutilizar os componentes e tokens visuais existentes.
- Incluir os metadados próprios da página exigidos pelo projeto.