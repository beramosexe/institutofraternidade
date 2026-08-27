# Fechamento da etapa "Associados"

Falta amarrar as pontas: o PIN de cadastro ainda não tem tela para ser definido, o formulário público não tem link em lugar nenhum, e quem está pendente ainda cai no painel normal.

## 1. PIN de cadastro (administração)

Novo bloco na página **Admin** (`/app/admin`), visível só para administradores:
- Mostra se o PIN já está configurado e a data da última alteração (nunca mostra o PIN em si).
- Campo para definir/trocar o PIN, com confirmação e aviso de que o PIN antigo deixa de funcionar.
- Enquanto o PIN não estiver configurado, um alerta indica que o formulário público de cadastro está fechado.

## 2. Entradas para o cadastro público

- Botão **"Quero me associar"** no cabeçalho do site e no rodapé, apontando para `/associados/cadastro`.
- Link **"Ainda não tenho conta — cadastrar como associado"** na página de login.
- Na tela de cadastro: quando o PIN não está configurado, mensagem clara ("cadastros temporariamente fechados, procure a equipe") em vez de erro genérico.

## 3. Fluxo de quem está pendente

- Ao entrar, o associado pendente é levado automaticamente para **Cadastro em análise** (`/app/pendente`); o painel, a biblioteca e as demais áreas ficam inacessíveis até a validação.
- Aviso no topo da página de análise com o tempo de espera estimado e contato da equipe.
- O associado pendente continua podendo editar seus próprios dados (nome, telefone) em Meus dados.

## 4. Validação em um passo

Na lista de associados, o botão **Validar** abre uma janela que já permite, na mesma ação:
- escolher a turma inicial (opcional) e a finalidade,
- marcar as funções/cargos iniciais (cargos críticos só para administração),
- confirmar a ativação.

Tudo registrado na linha do tempo do associado como um único evento de validação.

## 5. Painel e contagens

- Painel principal ganha um cartão **"Cadastros pendentes"** com o número e atalho, visível para quem gerencia associados.
- Item "Gestão de associados" no menu exibe um contador quando há cadastros aguardando validação.

## Detalhes técnicos

- `src/routes/_authenticated/app.admin.index.tsx`: novo card usando `getSignupPinStatus` / `setSignupPin` (já existem em `signup.functions.ts`), com `useMutation` + toast.
- `src/routes/associados.cadastro.tsx`: tratar `reason: "unconfigured"` de `checkSignupPin` com mensagem própria.
- `src/components/site/SiteLayout.tsx` e `src/routes/auth.tsx`: links `<Link to="/associados/cadastro">`.
- `src/routes/_authenticated/app.index.tsx`: `Navigate`/`useEffect` para `/app/pendente` quando `access.isPending`; novo card de pendentes usando uma contagem leve (`listMembers` já retorna o status, filtro no cliente).
- `src/routes/_authenticated/app.pendente.tsx`: texto de espera e contato.
- `src/routes/_authenticated/app.associados.index.tsx`: diálogo de validação (shadcn `Dialog` + `Select` de turmas e checkboxes de cargos) chamando `validateMember` com `role_ids`, `class_id` e `purpose` — a função já aceita esses campos.
- `src/components/app/AppShell.tsx`: suporte a badge numérico em item de navegação, alimentado por uma query de contagem de pendentes só quando o usuário tem `member.manage`.
- Sem migração de banco nesta etapa.
