# Plano: Timestamps precisos com Deepgram + editor de tempos

## Objetivo
Eliminar a dessincronização áudio↔transcrição substituindo o provedor de STT (Gemini → Deepgram) e dando ao revisor controle fino para corrigir `start`/`end` de cada segmento quando necessário.

## Escopo (3 frentes)

### 1. Novo provedor de transcrição: Deepgram
- Adicionar secret `DEEPGRAM_API_KEY` (solicitado ao usuário no início da implantação).
- Reescrever `supabase/functions/transcribe-audio/index.ts` para chamar `https://api.deepgram.com/v1/listen` com:
  - `model=nova-2` (melhor custo/qualidade em pt-BR)
  - `language=pt-BR`
  - `smart_format=true`, `punctuate=true`, `paragraphs=true`, `utterances=true`
  - `diarize=true` (opcional, mantém fala separada por interlocutor)
- Mapear resposta Deepgram → estrutura atual de `audio_transcriptions.segments`:
  - cada `utterance` vira um segmento `{ start, end, text, speaker? }`
  - timestamps em segundos com precisão de ~100 ms (medidos, não estimados)
- Manter `full_text` (concatenação dos segments) e `language`.
- Adicionar campo `provider` em `audio_transcriptions` para rastrear origem (`gemini` vs `deepgram`).

### 2. Re-transcrição sob demanda
- Botão "Re-transcrever com Deepgram" na tela de detalhe do áudio (`/app/audios/$id`), visível para admins e usuários com permissão de edição.
- Fluxo:
  1. Confirma com modal ("isso substituirá a transcrição atual e revisões manuais serão preservadas como histórico").
  2. Antes de sobrescrever, copia a transcrição atual para `transcription_revisions` com label `pre-redeepgram-{timestamp}`.
  3. Cria novo `processing_jobs` apontando para a edge function `transcribe-audio` em modo `force=true`.
  4. UI mostra status (queued → running → done) e atualiza tela ao concluir.
- Áudios antigos (com `provider != 'deepgram'`) ganham um badge "timestamps estimados — re-transcrever recomendado".

### 3. Editor de timestamps
- Estender `SyncedTranscript.tsx` (ou criar `EditableSyncedTranscript.tsx`) para o modo `editable`:
  - Cada segmento ganha dois campos de tempo (`mm:ss.sss`) editáveis ao lado do texto.
  - Botão "capturar tempo atual" do player → preenche `start` ou `end` do segmento focado.
  - Atalhos: `[` define `start` no tempo atual, `]` define `end`.
  - Validação: `start < end`, sem sobreposição com vizinhos (warning, não bloqueio).
- Disponível em:
  - `/app/revisao/$id` (revisão pública) — quem tem permissão de revisor
  - `/app/audios/$id` (detalhe interno) — admins e uploader do áudio
- Salvamento:
  - Edição cria entrada em `transcription_revisions` (já existe a tabela) com `segments` atualizado
  - Botão "Publicar como atual" promove a revisão ao `audio_transcriptions` ativo

## Detalhes técnicos

### Banco de dados
- `audio_transcriptions`: adicionar coluna `provider TEXT DEFAULT 'gemini'`.
- Nenhuma mudança em RLS (políticas atuais já cobrem leitura/escrita).

### Edge function
- Substituir chamada Gemini por Deepgram (fetch direto, sem SDK — Deepgram REST é simples).
- Manter contrato de entrada (`{ audio_id }`) e saída (status no `processing_jobs`).
- Erro tratado: se `DEEPGRAM_API_KEY` faltar → status `failed` com mensagem clara.

### UI
- Novo componente `RetranscribeButton.tsx` (detalhe do áudio).
- Refactor de `SyncedTranscript.tsx` para suportar `mode: 'view' | 'edit-text' | 'edit-text-and-timestamps'`.
- Hook `useTranscriptEditor` para gerenciar estado local + diff vs original.

### Custo / performance
- Deepgram nova-2 pt-BR: ~US$ 0,0043/min (~R$ 0,02/min). 1h de áudio ≈ R$ 1,30.
- Latência: ~1/10 da duração do áudio (10 min de áudio → ~1 min de transcrição).

## Ordem de execução
1. Migration: coluna `provider` em `audio_transcriptions`.
2. Solicitar secret `DEEPGRAM_API_KEY`.
3. Reescrever edge function `transcribe-audio` com Deepgram.
4. Testar upload novo → verificar timestamps batem com áudio.
5. Adicionar botão de re-transcrição + fluxo de backup em `transcription_revisions`.
6. Implementar editor de timestamps no `SyncedTranscript`.
7. Habilitar editor em `/app/revisao/$id` e `/app/audios/$id` com checagem de permissão.

## Fora de escopo (por ora)
- Re-transcrição automática em massa de todo o histórico.
- Edição de palavras individuais (word-level) — fica no nível de segmento.
- Diarização avançada (separação de speakers em UI distinta).

## Quando começar
Plano fica pronto e arquivado. Quando você disser "vamos implantar", começamos pela migration + secret.
