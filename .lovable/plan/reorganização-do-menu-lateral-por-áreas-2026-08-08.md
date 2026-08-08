# Reorganização do menu lateral por áreas

## Novo menu lateral

```text
GERAL
  Painel                  /app
  Áudios                  /app/audios
  Trabalhos               /app/trabalhos          (novo — agenda somente leitura)

GESTÃO ÁUDIOS E REVISÃO
  Gestão de áudios        /app/admin/audios

ACOLHIMENTO
  Controle de presença    /app/acolhimento        (novo)

ESTOQUE                   Em breve
MANUTENÇÃO                Em breve
FINANCEIRO                Em breve
MÍDIAS                    Em breve

ADMINISTRAÇÃO
  Admin                   /app/admin              (novo — inclui Cargos)
  Gestão dos trabalhos e eventos   /app/admin/trabalhos
  Logs                    /app/admin/logs
  Usuários                /app/admin/usuarios
```

Cada seção só aparece quando o usuário tem permissão para ao menos uma de suas abas. As seções sem abas ainda (Estoque, Manutenção, Financeiro, Mídias) aparecem com o rótulo "Em breve" e item desabilitado.

## O que sai do menu e vira botão

Dentro da página **Gestão de áudios** entram botões de ação no topo:
- **Enviar áudio** (para quem pode enviar)
- **Entidades** (entidades de canalização)
- **Revisão** (fila de revisão de transcrições)
- **Meus uploads**

As páginas continuam existindo nos mesmos endereços; apenas deixam de ocupar espaço no menu.

## Novas páginas

**Trabalhos (Geral)** — agenda dos trabalhos publicados: nome, data/hora, modalidade, local, responsáveis e link para o áudio quando houver. Sem criar, editar ou excluir. A versão com edição permanece em Administração, renomeada para "Gestão dos trabalhos e eventos".

**Controle de presença (Acolhimento)** — lista os trabalhos de hoje e dos próximos dias com acesso direto à tela de check-in já existente, mais busca por trabalhos passados para lançar presença retroativa.

**Admin** — página central da administração, com o controle de criação e edição de **Cargos** (movido de "Cargos" no menu) e, como sugestão adicional, atalhos para Usuários, Logs e um resumo rápido (nº de usuários, cargos, áudios pendentes de revisão).

## Permissões

- Nova permissão **Controle de presença** (`attendance.manage`) adicionada à lista de permissões atribuíveis a cargos, com um cargo de sistema **Acolhimento** já criado com ela.
- "Trabalhos" (Geral) fica visível para qualquer usuário autenticado.
- "Admin" exige ser administrador; "Cargos" continua exigindo gerenciar cargos.

## Detalhes técnicos

- Migração: novo valor `attendance.manage` no enum `app_permission`; inserção do cargo de sistema `acolhimento` com essa permissão; `ALL_PERMISSIONS`/`PERMISSION_LABELS` em `src/lib/permissions.ts` atualizados; lista de permissões do admin em `me.functions.ts` atualizada.
- `AppShell.tsx`: estrutura de navegação passa de dois arrays para um array de seções `{ label, items, comingSoon }`, com filtro por permissão por item e ocultação de seções vazias (exceto as "Em breve").
- Novas rotas: `src/routes/_authenticated/app.trabalhos.index.tsx`, `app.acolhimento.tsx`, `app.admin.index.tsx` (esta reaproveitando o componente de cargos hoje em `app.admin.cargos.tsx`; a rota `/app/admin/cargos` é mantida como redirecionamento para `/app/admin`).
- `app.admin.audios.tsx`: barra de ações com os quatro botões, cada um condicionado à permissão correspondente.
- Novos loaders de trabalhos usam server functions já existentes em `works.functions.ts` / `attendance.functions.ts`; se faltar uma listagem somente-leitura, adiciono uma função nova sem alterar as existentes.
- Cada nova rota recebe `head()` própio com título e descrição.
