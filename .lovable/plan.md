# Diagnóstico: o áudio não está sendo transcrito

Verifiquei o banco. Esse áudio (“Canalização S Zé - 05/08/2026”) está travado:

- Status do áudio: `transcribing` desde **05/08/2026 23:22**
- Existe **um único** job de transcrição, criado em 05/08 23:22, com status `running`, `attempts = 0`, sem `finished_at` e sem `error_message`
- **Nenhuma** linha de transcrição foi gravada para ele

Ou seja: a transcrição foi iniciada uma vez, o processo morreu no meio (provavelmente estouro de tempo/memória ao baixar e enviar o arquivo de ~3,8 MB) e ninguém marcou o job como erro. Como o app só mostra “Transcrevendo…” enquanto o status é `transcribing`, ele fica preso nesse estado para sempre.

## O que fazer

### 1. Destravar este áudio agora
Reprocessar a transcrição desse áudio e acompanhar o resultado. Se falhar de novo, o erro passará a ficar visível (item 2).

### 2. Nunca mais ficar preso em “Transcrevendo…”
- Marcar como erro qualquer job `running` que passe de um tempo limite (ex.: 15 minutos), colocando o áudio em `error` com mensagem clara
- Garantir que o processamento sempre registre falha no job e no áudio, inclusive quando o processo é interrompido

### 3. Botão de “Transcrever novamente” onde ele falta
Hoje o reprocessamento só existe na administração de áudios. Adicionar a ação também:
- Na página de detalhe do áudio, quando o status for `error` ou estiver travado
- Com aviso visível do motivo do erro, para quem tem permissão

### 4. Feedback de progresso
Enquanto o status for `transcribing`, atualizar a tela automaticamente (a cada poucos segundos) para que a transcrição apareça sozinha quando terminar, sem recarregar a página.

## Detalhes técnicos

- Áudio: `007753a5-166b-45d6-87e4-5a0f21d62c0c`; job travado: `7a2f0b6d-342b-477d-a446-b67d9db6c1fc`
- `supabase/functions/transcribe-audio/index.ts`: envolver o fluxo em proteção de tempo, sempre atualizar `processing_jobs` e `audios` em caso de falha, e registrar log do motivo
- Regra de job obsoleto (`running` há mais de 15 min → `error`) aplicada na leitura do detalhe/biblioteca e no início de um novo reprocessamento
- `src/routes/_authenticated/app.audios.$id.tsx`: exibir `error_message`, botão de reprocessar (`reprocessAudio`) para `audio.reprocess` / `audio.edit_any` / quem enviou, e `refetchInterval` enquanto `status === "transcribing"`

## Observação sobre timestamps

Independente disso, o modelo atual não devolve timestamps medidos — a sincronia continua dependendo do editor manual de tempos já implementado. Trocar de provedor (Deepgram/AssemblyAI) segue como caminho futuro.
