
## 1. Login — visualizar senha e "Lembrar de mim"

Em `src/routes/auth.tsx`:

- Campo senha vira `Input` com ícone olho/olho-cortado (`Eye`/`EyeOff`) que alterna entre `type="password"` e `type="text"` (apenas no SignIn; replicar no SignUp opcional).
- Checkbox "Lembrar de mim" abaixo do campo senha.
  - Quando marcado: comportamento padrão (sessão persiste no `localStorage`).
  - Quando desmarcado: após login, sinalizar `sessionStorage.setItem("if-session-only","1")` e, no `onAuthStateChange("SIGNED_IN")`, mover a sessão para `sessionStorage` (assim some ao fechar o navegador). Preferência fica gravada em `localStorage` para próxima visita.

## 2. Entidades canalizadoras (gestão admin + dropdown)

Nova tabela global + ligação opcional por trabalho.

```text
channeling_entities         (id, name, description, is_active, created_at, updated_at)
work_entity_favorites       (work_id, entity_id)   -- entidades "favoritas" daquele trabalho
```

RLS: leitura para `authenticated`; escrita exige `user.manage` ou admin (reaproveita perfil admin).

Nova rota admin: `src/routes/_authenticated/app.admin.entidades.tsx` (CRUD simples — listar, criar, editar nome/descrição, ativar/desativar). Link no `AppShell` em Administração (gate `user.manage`).

Server fns em `src/lib/entities.functions.ts`: `listEntities`, `createEntity`, `updateEntity`, `deleteEntity`, `setWorkFavoriteEntities(workId, entityIds[])`.

### Uso no upload de áudio (`app.upload.tsx`)

Substituir o input livre "Mensagem de quem" por um `Select` (ou Combobox) populado com entidades ativas. Se um trabalho estiver selecionado, ordenar primeiro as favoritas dele. Última opção: **"Outro…"** — ao escolher, abre `Input` para texto livre. Persistência: a coluna existente `audios.message_source` continua armazenando o texto final (nome da entidade ou o livre); adicionar coluna opcional `message_entity_id uuid` para vínculo estruturado quando vier do dropdown.

Mesmo padrão aplicável onde "Trabalho" pede tipo da canalização — mantemos o select de trabalhos como já existe.

## 3. Trabalhos — recorrência, modalidade, responsáveis

Alterações em `works` + novas tabelas.

```text
ALTER TABLE works ADD COLUMN modality      text   -- 'presencial' | 'online' | 'hibrido' | 'externo'
ALTER TABLE works ADD COLUMN recurrence    text   -- 'one_off' | 'weekly'
ALTER TABLE works ADD COLUMN recurrence_weekday smallint   -- 0-6 quando weekly
ALTER TABLE works ADD COLUMN recurrence_time    time       -- hora local
ALTER TABLE works ADD COLUMN is_template   boolean default false
ALTER TABLE works ADD COLUMN template_id   uuid references works(id) on delete set null

CREATE TABLE work_responsibles (work_id uuid, user_id uuid, primary key (work_id, user_id))
```

Modelo: trabalho recorrente é criado como **template** (`is_template=true`); ocorrências concretas têm `template_id` apontando para ele e `starts_at` real. Um job semanal (pg_cron + rota `/api/public/hooks/generate-occurrences`) materializa as próximas ~12 semanas e regenera ao avançar. Trabalho pontual (`one_off`) é criado direto, sem template.

### Form do trabalho (`app.admin.trabalhos.tsx`)

Adicionar ao `WorkDialog`:
- Select **Recorrência**: Pontual (uma vez) / Semanal recorrente. Se Semanal: aparecem campos Dia da semana + Hora (substituem `datetime-local`).
- Select **Modalidade**: Presencial / Online / Híbrido / Externo. Quando Externo, mostrar destaque no campo Local.
- Multi-select **Responsáveis** (`Combobox` com busca por nome em `profiles`, multi).
- Multi-select **Entidades frequentes** (das `channeling_entities`).
- Multi-select **Participantes frequentes** (perfis) — alimenta `work_participants`.

### Permissões dos responsáveis

Atualizar funções SQL e RLS:
- Nova função `is_work_responsible(_user_id, _work_id)`.
- Policies de `works` (update), `attendance` (insert/update/delete), `audios` vinculados ao trabalho passam a aceitar `is_work_responsible` além de admin/`work.manage`.
- Server fns sensíveis (`updateWork`, futuras de check-in) checam `is_admin OR has_permission('work.manage') OR is_work_responsible`.

## 4. Check-in / lista de presença

Nova rota: `src/routes/_authenticated/app.trabalhos.$id.checkin.tsx` (acesso: admin, `work.manage` ou responsável).

Tabela `attendance` já existe; ampliar:

```text
ALTER TABLE attendance ADD COLUMN occurrence_date date NOT NULL DEFAULT current_date
ALTER TABLE attendance ADD COLUMN guest_name      text
ALTER TABLE attendance ADD COLUMN guest_email     text
ALTER TABLE attendance ADD COLUMN guest_phone     text
ALTER TABLE attendance ADD COLUMN invited_user_id uuid   -- preenchido quando o convidado virar usuário depois
-- user_id passa a ser nullable (guest sem conta)
UNIQUE (work_id, occurrence_date, coalesce(user_id::text, guest_email, guest_phone))

CREATE TABLE pending_invites (id, work_id, email, phone, full_name, created_by, created_at)
```

Trigger no `handle_new_user`: após criar perfil, procurar `pending_invites` por e-mail e popular `attendance.invited_user_id` retroativamente + adicionar como participante.

### UI

- Cabeçalho: trabalho + data da ocorrência (`occurrence_date`, padrão hoje, ajustável).
- Lista "Frequentes" — vem de duas fontes mescladas:
  1. `work_participants` (marcação manual);
  2. usuários com ≥ 3 check-ins anteriores naquele trabalho.
  Cada linha: avatar + nome + toggle Presente.
- Botão "Adicionar presença" abre Combobox com **busca incremental** (1+ caractere chama server fn `searchProfiles(workId, q)` que retorna até 8 perfis por `full_name ILIKE q%`). Ao clicar, marca presença na hora.
- Se nenhum resultado, mostrar "Adicionar como convidado" → mini-form (nome obrigatório, e-mail OU telefone obrigatório). Grava em `attendance` como guest e cria `pending_invites` para futuro vínculo.

### Server fns (`src/lib/attendance.functions.ts`)

`getCheckinData(workId, date)`, `searchProfiles(workId, q)`, `markPresence({workId, date, userId?, guest?})`, `unmarkPresence(id)`, `listPendingInvites(workId)`.

## 5. Tarefas técnicas resumo

1. Migração SQL: novas colunas em `works`/`attendance`, tabelas `channeling_entities`, `work_entity_favorites`, `work_responsibles`, `pending_invites`; função `is_work_responsible`; ajuste de RLS e trigger `handle_new_user`.
2. Server fns: `entities.functions.ts`, `attendance.functions.ts`; expandir `works.functions.ts` (recurrence, modality, responsibles, favoritos, participantes frequentes).
3. UI: `auth.tsx` (mostrar senha + lembrar); `app.upload.tsx` (combobox entidades + Outro); `app.admin.trabalhos.tsx` (form completo); nova rota admin entidades; nova rota check-in.
4. Sidebar: adicionar links "Entidades" (admin) e "Check-in" (a partir da página do trabalho).
5. Cron `pg_cron` semanal chamando `/api/public/hooks/generate-occurrences` para materializar 12 semanas de trabalhos recorrentes.

Confirme para eu implementar — começando pelas migrações, depois server fns, depois UI.
