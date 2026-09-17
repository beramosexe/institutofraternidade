# Ajuste da transcrição compacta do áudio

Simplificar a leitura sincronizada sem alterar áudio, dados ou permissões.

## Mudanças

- Corrigir a visibilidade do ícone central de reproduzir/pausar.
- Manter os títulos e avisos da transcrição abaixo do player.
- Na visão compacta, trocar a lista vertical por uma faixa horizontal com o trecho atual central, anterior e próximo mais discretos, rolagem lateral e acompanhamento automático.
- Ao expandir, preservar a transcrição completa atual, incluindo busca, seleção de trecho e ferramentas de revisão.
- Garantir que tocar em um trecho lateral pule o áudio para aquele ponto.

## Verificação

- Conferir reprodução e alternância entre compacto/completo.
- Validar a faixa sincronizada em celular e desktop, sem sobreposição ou erros.

## Detalhes técnicos

- Ajustar `src/components/app/SyncedTranscript.tsx` e o controle de expansão em `src/routes/_authenticated/app.audios.$id.tsx`.
- Reutilizar os componentes e tokens visuais existentes.
