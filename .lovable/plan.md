
# Instituto Fraternidade — Plano da V1 (atualizado)

Aplicação completa com site público + área autenticada, biblioteca de áudios com transcrição automática **com revisão humana e sincronização ao player**, módulo de trabalhos/agenda, gestão flexível de cargos e administração. Banco unificado no Lovable Cloud (Supabase), preparado para check-in, permissões granulares e auditoria.

## Identidade visual

- Paleta serena baseada no logo: azul suave (#A8B8D9), branco quente, cinzas claros, dourado discreto.
- Tipografia: serifa leve para títulos (Fraunces/Cormorant) + sans humanista para corpo (Inter).
- Mobile-first, acessível, tokens semânticos em `src/styles.css`.
- Logo branco sobre fundo azul; avatar (globo+coração) como ícone/favicon.

## Rotas

Público:
- `/` Home, `/quem-somos`, `/agenda`, `/canalizacoes`, `/contato`, `/auth`

Autenticado:
- `/app` dashboard
- `/app/audios` biblioteca + player + transcrição sincronizada + busca
- `/app/audios/$id` detalhe
- `/app/upload` formulário (uploaders)
- `/app/meus-uploads`
- `/app/revisao` **fila de transcrições não revisadas** (para uploaders/revisores)
- `/app/revisao/$id` **editor de transcrição sincronizado com áudio**
- `/app/admin/trabalhos`
- `/app/admin/audios`
- `/app/admin/usuarios` (gestão de pessoas, cargos e atribuições)
- `/app/admin/cargos` **CRUD de cargos customizados + permissões**
- `/app/admin/logs`

## Cargos flexíveis (novidade)

Em vez de enum fixo, sistema baseado em **cargos (roles) editáveis** + **permissões**:

- `roles` (id, slug, name, description, is_system) — `is_system` marca os 4 base não removíveis: `admin`, `associate`, `uploader`, `reviewer`.
- `permissions` enum fixo no código (granular):
  `audio.upload`, `audio.edit_any`, `audio.delete`, `audio.publish`, `audio.reprocess`,
  `transcription.review`, `transcription.approve`,
  `work.manage`, `user.manage`, `role.manage`, `logs.view`,
  `content.associate_only`, `content.public_only`.
- `role_permissions` (role_id, permission) — admin define quais permissões cada cargo possui via UI checkboxes.
- `user_roles` (user_id, role_id) — usuário pode ter múltiplos cargos.
- Função SQL `has_permission(user_id, permission)` SECURITY DEFINER consultada em RLS e server fns.
- UI `/app/admin/cargos`: criar cargo, marcar permissões; `/app/admin/usuarios`: atribuir/remover cargos por usuário (multi-select).

Admin sempre tem todas as permissões implicitamente.

## Banco de dados

- `profiles` (id=auth.users, full_name, avatar_url, phone)
- `roles`, `role_permissions`, `user_roles` (acima)
- `works` (id, name, description, starts_at, location, status, visibility, created_by)
- `work_participants` (work_id, user_id)
- `attendance` (work_id, user_id, checked_in_at) — estrutura para check-in futuro
- `audios` (id, work_id, title, description, recorded_at, audio_type, message_source, access_level, original_url, stream_url, duration_seconds, uploaded_by, published_at, status, error_message)
- `audio_transcriptions` (id, audio_id, language, text, segments jsonb [{start,end,text}], provider, **review_status** [`unreviewed`|`in_review`|`reviewed`], **reviewed_by**, **reviewed_at**, version)
- `transcription_revisions` (id, transcription_id, editor_id, segments_before jsonb, segments_after jsonb, note, created_at) — histórico de edições
- `audio_access_grants` (audio_id, user_id) — overrides
- `audit_logs` (actor_id, entity, entity_id, action, diff jsonb, created_at)
- `processing_jobs` (audio_id, job_type, status, attempts, payload, result, started_at, finished_at)
- Storage: `audios-original` (privado), `audios-stream` (signed URLs)
- Index FTS: `to_tsvector('portuguese', text)` em `audio_transcriptions`.

## Pipeline de áudio

1. Upload via signed URL para `audios-original`.
2. Server fn cria `processing_jobs` (convert + transcribe).
3. **Conversão**: estrutura plugada para serviço externo (Cloudflare Worker não roda ffmpeg). V1 fallback: usa o próprio arquivo como stream (mp3/m4a/webm tocam direto).
4. **Transcrição**: Lovable AI / Whisper (`whisper-1` via OpenAI compatível) — gera `text` + `segments` com timestamps por sentença.
5. Status do áudio passa para `ready`; transcrição entra como `review_status='unreviewed'`.
6. Reprocessamento manual por quem tem `audio.reprocess`.

## Player com transcrição sincronizada

Componente `SyncedTranscript`:
- Player HTML5 controlado por `currentTime`.
- Lista de segmentos `{start, end, text}`; segmento ativo destacado (highlight + auto-scroll suave).
- Clique em segmento → `audio.currentTime = segment.start`.
- Atalhos de teclado: espaço (play/pause), ←/→ (pular 5s), Tab (próximo segmento).
- Modo leitura (na biblioteca) e modo edição (na revisão).

## Interface de revisão de transcrição

Rota `/app/revisao/$id` (acesso: `transcription.review`):
- Layout em duas colunas (stack em mobile):
  - Esquerda: player sticky + controles (velocidade 0.75x/1x/1.25x, pular 5s, loop do segmento atual).
  - Direita: lista editável de segmentos. Cada segmento é um `textarea` inline com timestamp clicável.
- Atalhos: `Tab` próximo, `Shift+Tab` anterior, `Ctrl+Enter` salvar segmento, `Ctrl+L` loop segmento, `Esc` pausar.
- Salvamento automático a cada edição (debounce 1s) → grava versão em `transcription_revisions`.
- Botões: **"Marcar como revisada"** (define `review_status='reviewed'`, registra revisor), **"Pedir nova revisão"**.
- Badge "Não revisada" exibida na biblioteca enquanto `review_status != 'reviewed'`; usuário comum vê transcrição com aviso "transcrição automática, pode conter erros".

Fila `/app/revisao`: lista áudios com `review_status != 'reviewed'`, filtros por trabalho, uploader, idade, com botão "Revisar".

Permissão de revisão: quem tem `transcription.review` OU é o `uploaded_by` do áudio.

## Autenticação

- Lovable Cloud: email/senha + Google.
- Trigger cria `profile` e atribui cargo default (`associate` configurável).
- Layout `_authenticated/route.tsx` managed.
- Server fns sensíveis: `requireSupabaseAuth` + `has_permission()`.

## Tecnologia

- TanStack Start, React 19, Tailwind v4, shadcn/ui, TanStack Query.
- Lovable Cloud (DB/Auth/Storage), Lovable AI Gateway para Whisper.
- Validação Zod, limites de upload (500MB, mp3/m4a/wav/webm/ogg).
- Auditoria via triggers SQL nas tabelas críticas.

## Entregáveis V1

1. Schema completo + RLS + função `has_permission` + seeds (admin, cargos base, trabalhos exemplo).
2. Design system + site público (5 páginas).
3. Auth + perfil.
4. Dashboard + biblioteca de áudios com **player + transcrição sincronizada** + busca FTS.
5. CRUD Trabalhos.
6. Upload de áudio com status.
7. Pipeline de transcrição (Whisper via Lovable AI) com segmentos timestamped.
8. **Fila e editor de revisão de transcrição sincronizado** com salvamento incremental e histórico.
9. Admin: gestão de áudios, **gestão de cargos (CRUD + permissões)**, **atribuição de cargos por usuário**, logs.
10. Estrutura `attendance` pronta (regra `attendees_only` já aplicada nas RLS).

## Fora da V1 (preparado)

- Tela de check-in com QR.
- Conversão ffmpeg em serviço externo dedicado.
- Notificações por email/push (ex: "sua transcrição foi revisada").
- App mobile nativo.

Confirme para eu habilitar o Lovable Cloud e iniciar pela base (schema + design + auth), depois site público, depois biblioteca + revisão.
