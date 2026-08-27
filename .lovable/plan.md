# Etapa: Associados, Turmas e Histórico

Escopo desta etapa: cadastro de associados com PIN, turmas e níveis de formação, status ativo/inativo com histórico, linha do tempo do associado e a área de Gestão de Associados. Áudios, Estoque/Compras/Financeiro/Manutenção e notificações ficam para etapas seguintes.

## Estado atual verificado

- Hoje existem `profiles`, `roles`, `role_permissions`, `user_roles` e as permissões do enum `app_permission` (áudios, trabalhos, usuários, cargos, logs, presença). Não existe nenhuma tabela de turmas, vínculos, períodos de atividade ou histórico do associado.
- A função de criação de conta (`handle_new_user`) atribui automaticamente o cargo `associate` a todo novo usuário (e `admin` ao primeiro). Isso contraria a regra "a conta é criada sem permissões internas" e será ajustado.
- Não existe hoje nenhum mecanismo de PIN de cadastro.

## Cadastro com PIN

- Nova página pública `/associados/cadastro`. Primeiro passo: informar o PIN. PIN correto libera o formulário (nome completo, e-mail, telefone, senha).
- PIN único global, guardado em uma tabela de configurações do sistema (valor com hash), editável pela administração em Admin → Configurações. A validação do PIN acontece no servidor; o PIN nunca é enviado ao navegador.
- A conta criada entra como **pendente de validação**: sem cargo operacional, sem turma, sem permissões. Ao entrar, a pessoa vê uma tela de "cadastro em análise" com seus dados pessoais e nada mais.
- A gestão de associados (ou a administração) valida o cadastro e configura status, turma, nível e funções.

## Turmas e níveis

- Níveis oficiais: Básico, Intermediário, Avançado, Instrutores, Mediunidade (lista administrável, não fixa no código).
- Turma com: nome (sugerido automaticamente a partir de "Turma N + Nível + Ano", editável), nível, ano/período, status (Planejada, Aberta, Em andamento, Encerrada, Cancelada), datas de abertura e encerramento, responsável pela criação, observações.
- Vínculo associado ↔ turma como registro próprio: data de entrada, data de saída, status, finalidade, responsável pela alteração, observações. **Vínculos simultâneos são permitidos** quando a finalidade for registrada; o sistema identifica a turma principal atual separadamente do histórico.
- Abrir turma não altera nível nem turma de ninguém automaticamente. Vincular/desvincular gera evento na linha do tempo.
- Ações: abrir, editar, encerrar, reabrir, cancelar turma; adicionar/remover associados; consultar histórico.

## Status e períodos de atividade

- Em vez de um campo ativo/inativo simples, o associado tem períodos de atividade (início, fim, motivo, responsável).
- Regra de acesso retroativo: conteúdo restrito publicado dentro de um período em que a pessoa estava ativa continua acessível; conteúdo publicado durante inatividade não é liberado ao reativar.
- Associado inativo mantém conta, dados e histórico, e perde acesso às áreas operacionais/administrativas.

## Linha do tempo do associado

Eventos registrados com data e responsável: entrada no Instituto, configuração inicial da conta, vínculo/mudança de turma, evolução de nível, alteração de funções, alteração de permissões, início de período ativo/inativo, retorno à atividade. Nada é sobrescrito sem preservar o histórico.

## Menu lateral reorganizado

```text
ÁREA DO ASSOCIADO
  Painel · Áudios · Trabalhos

PAINEL DA CASA                (placeholder nesta etapa)

MINHA CONTA
  Meu perfil · Minha formação · Minha turma atual
  Turmas anteriores · Meu histórico

MINHAS ÁREAS                  (dinâmico por função/permissão)
  Gestão de associados · Gestão de áudios · Acolhimento · …

ADMINISTRAÇÃO
  Admin · Gestão de trabalhos · Usuários · Logs · Configurações
```

No topo do menu: perfil do associado e o rótulo "Área do Associado", que muda para "Associado Inativo" quando aplicável.

## Gestão de Associados (nova área)

Área própria, liberada por permissão, com:
- Fila de cadastros pendentes de validação, com ação de validar e configurar a conta.
- Lista de associados em formato de planilha: nome, status, turma atual, nível, funções — com edição rápida.
- Ficha do associado: dados, turmas (atual e anteriores), períodos de atividade, funções e linha do tempo.
- Turmas: criar, editar, encerrar, reabrir, gerenciar associados.

## Permissões

- Novas permissões: `member.validate`, `member.manage`, `class.manage`, `member.role_assign`.
- **Permissões críticas** (somente administração pode conceder): `audio.delete` e demais exclusões definitivas, e `logs.view`. Também permanecem restritas `role.manage` e a marcação de criticidade.
- A gestão de associados pode atribuir funções e permissões operacionais, mas nunca as críticas; ninguém pode alterar suas próprias funções, permissões, turma, nível ou status.
- Toda regra é aplicada no banco (RLS + funções de verificação), não apenas escondendo botões.

## Auditoria

Registradas no histórico de auditoria já existente: criação e validação de associado, configuração de conta, ativação/inativação, alteração de funções e permissões, criação/alteração/abertura/encerramento de turmas, vinculação a turmas e mudança de nível — sempre com autor, data e o que mudou.

## Detalhes técnicos

- Migração: tabelas `system_settings` (PIN com hash), `formation_levels`, `classes`, `class_members`, `member_status_periods`, `member_events`, `member_functions` (reaproveitando `roles`/`role_permissions` como funções), com GRANTs, RLS e políticas baseadas em novas funções `security definer`: `can_manage_members`, `can_manage_classes`, `is_permission_critical`, `was_active_at(_user_id, _at)`.
- Colunas novas em `profiles`: `membership_status` (pendente, ativo, inativo), `validated_at`, `validated_by`.
- `handle_new_user` ajustado: novo usuário entra sem cargo operacional (mantém o `admin` para o primeiro usuário); a atribuição de `associate` passa a ser ato administrativo na validação.
- Nova coluna em `role_permissions`/`app_permission`: marcação de criticidade em tabela `critical_permissions` administrável.
- Server functions novas em `src/lib/members.functions.ts`, `classes.functions.ts`, `signup.functions.ts` (validação de PIN + criação de conta via cliente admin, após verificar o PIN no servidor), todas com `requireSupabaseAuth` exceto o fluxo público de PIN.
- Rotas novas: `src/routes/associados.cadastro.tsx` (pública), `_authenticated/app.conta.*` (Minha Conta), `_authenticated/app.associados.*` (gestão e turmas), `_authenticated/app.pendente.tsx`. Cada rota com `head()` próprio.
- `AppShell.tsx`: seções reorganizadas conforme o menu acima, com "Minhas Áreas" derivada das permissões e cabeçalho de perfil/status.
- Regra de acesso retroativo aplicada em `can_access_audio`, usando `was_active_at` com a data de publicação do áudio.
