# Diagnóstico: por que esse áudio travou

Reconstruí a linha do tempo do áudio “Canalização S Zé - 05/08/2026” pelo banco:

- 23:22:50 — áudio criado já com status `transcribing`
- 23:22:53 — última atualização do áudio (`updated_at`)
- 23:22:54 — a função de transcrição começou e gravou o job com status `running`
- Depois disso: **nada**. Job segue `running`, sem `finished_at`, sem `error_message`, `attempts = 0`, e **nenhuma** transcrição foi gravada
- Não há registro em `audit_logs` para esse upload (o último é de 31/07)
- Não há logs da função no período (janela de retenção já expirou)

## Causa

A função de transcrição foi **interrompida abruptamente no meio da execução**, sem passar pelo tratamento de erro. Prova disso é que ela conseguiu marcar o job como `running` (só ela faz isso, com chave de serviço) mas nunca marcou `done` nem `error` — o bloco `catch` nunca rodou. Isso é o padrão de morte por **limite de tempo/recursos** da função, não de erro da API: o arquivo tem ~3,8 MB e é baixado inteiro para a memória, remontado em `FormData` e enviado ao provedor de STT em uma única requisição, sem nenhum limite de tempo.

Dois problemas estruturais reforçam o travamento:

1. **Nada detecta job órfão.** Sem `catch`, o áudio fica em `transcribing` para sempre e a tela mostra “Transcrevendo…” eternamente.
2. **O job inicial nunca é criado pelo app.** `registerAudio` tenta inserir em `processing_jobs` e em `audit_logs` com o cliente do usuário, mas essas tabelas bloqueiam `INSERT` por RLS. Os erros são ignorados (nenhum `error` é checado), então o upload “passa” sem trilha de auditoria e sem job de fila. Só existe o job que a própria função criou.

Como o app só mostra “Transcrevendo…” enquanto o status é `transcribing`, ele fica preso nesse estado para sempre.


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
