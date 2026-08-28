# Etapa 6 — Áudios e Canalizações

Reorganização completa da área de áudios conforme os itens 11 a 20 do documento, incluindo o envio pelo Atalho do iPhone.

## 1. Biblioteca reorganizada (itens 11 e 12)

- Três blocos na página de áudios: **Mais recentes**, **Em destaque** (por número de reproduções iniciadas) e **Todos os áudios** com busca e filtros.
- Busca ampliada: título, resumo, palavras-chave, entidade/mentor, trabalho e transcrição. O campo passa a sugerir exemplos ("tópicos, trabalhos, entidades, palavras-chave").
- Filtros por trabalho, tipo, entidade e nível de acesso; palavras-chave clicáveis viram filtro.
- Contagem de plays registrada quando o áudio começa a tocar (uma vez por sessão de escuta).

## 2. Identificação visual (item 14)

- Cada trabalho ganha uma cor definida na administração de trabalhos (paleta pronta + cor livre).
- O card e a página do áudio herdam a cor do trabalho em faixa/borda lateral.
- Áudios não públicos exibem ícone de cadeado com o texto do nível ("Associados", "Participantes deste trabalho", "Presentes no trabalho"). Público não mostra indicador. A informação nunca depende só de cor.

## 3. Página do áudio e player (itens 15, 18 e 19)

- Estrutura única: Player → Informações → Resumo → Palavras-chave → Transcrição.
- Player redesenhado para celular: controles grandes, barra de progresso tocável, -15s/+15s, velocidade (0,75x–2x), tempo restante e player fixo no rodapé ao rolar a página.
- Transcrição colapsável em três estados: **fechada** (padrão), **parcial** (primeiros trechos) e **completa**, com sincronização e rolagem automática mantidas.
- Resumo e palavras-chave herdam exatamente a mesma política de acesso do áudio (nada exposto separadamente).

## 4. Resumo e palavras-chave por IA (item 17)

- Depois da transcrição, geração automática de resumo descritivo e palavras-chave, com instrução explícita de apenas sintetizar o que foi falado — sem interpretar, julgar ou inventar — e sem inferir entidade/mentor.
- Botão "Gerar novamente" na gestão de áudios e na revisão; o resumo é editável por quem revisa.
- Estado visível quando o resumo ainda está sendo gerado ou falhou.

## 5. Título automático sugerido (item 16)

- No envio de áudio, o título é sugerido a partir de entidade + trabalho + data (ex.: "Canalização — Mentor X — Trabalho Y — 12/03/2026"), sempre editável antes de salvar.

## 6. Envio pelo Atalho do iPhone (item 20)

- Cada pessoa com permissão de envio gera um **token pessoal de envio** em "Enviar áudio" (mostrado uma única vez, revogável, com registro de último uso).
- Novo endpoint público autenticado por esse token que recebe o arquivo e cria o áudio no mesmo pipeline (armazenamento → transcrição → resumo → revisão), com o nível de acesso padrão definido pela pessoa.
- Áudios enviados por atalho entram como "pendentes de complemento": título sugerido, trabalho/entidade a confirmar depois no site.
- Tela com instruções passo a passo para montar o Atalho no iPhone (URL, cabeçalho do token e campo do arquivo).

## Detalhes técnicos

- Banco (uma migração): tabela `audio_upload_tokens` (hash do token, dono, nível padrão, último uso, revogação) com RLS por dono e GRANTs; índices de busca em `audios` (resumo/palavras-chave); `works.color` já existe e será usado.
- IA: `createServerFn` chamando o Lovable AI Gateway (`google/gemini-3.7-flash`) para resumo + palavras-chave a partir do texto da transcrição, gravando em `audios.summary` / `audios.keywords`. Tratamento explícito de 402/429.
- Endpoint do Atalho: rota `src/routes/api/public/audio-upload.ts` — valida o token (comparação por hash), limita tamanho e tipo do arquivo, grava no bucket privado `audios` e enfileira a transcrição. Sem PII na resposta.
- Plays: RPC `register_audio_play` já existente, chamada no primeiro play.
- Player e transcrição: refatoração de `SyncedTranscript.tsx` e da página do áudio, mantendo o editor de timestamps já implementado.
