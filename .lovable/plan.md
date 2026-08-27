# Executar o documento completo (Re-call 1) — em etapas

Reli o documento inteiro (45 seções). Abaixo está o que já existe, o que falta, e a ordem de execução em 7 etapas. Cada etapa é entregue completa (banco + regras de acesso + tela), para não deixar função pela metade.

## Já existe hoje
Site público, login (com PIN de cadastro de associados), cargos/permissões com RLS, status do associado (pendente/ativo/inativo) e períodos de atividade, turmas e níveis, validação de cadastro, trabalhos com recorrência/modalidade/responsáveis, presença (check-in), biblioteca de áudios com níveis de acesso, transcrição com editor sincronizado e revisão, estoque básico, auditoria e painel Admin.

## Etapa 1 — Núcleo de permissões e criticidade
- Marcar formalmente quais permissões são críticas (administração, concessão de permissões, dados restritos, aprovação financeira, exclusão definitiva) e impedir, no banco, que quem não é administrador atribua permissão crítica — inclusive a si mesmo.
- Perfil "Gestão de Associados" com poder de configurar contas, turmas, níveis e funções não críticas, sem acesso total.
- Funções criadas/editadas pela gestão só podem conceder permissões não críticas.
- Registrar em auditoria toda alteração de função, permissão, turma, nível e status.

## Etapa 2 — Reorganização do menu e Painel da Casa
- Menu lateral reorganizado exatamente nos blocos do documento: Área do Associado, Painel da Casa, Minha Conta, Minhas Áreas (dinâmico por permissão), Administração.
- Topo do menu com foto/nome e selo "Área do Associado" — trocando para "Associado Inativo" quando for o caso.
- Painel da Casa (todos os associados): abrir chamado de manutenção e avisar falta de item no estoque.
- Minha Conta: perfil, formação, turma atual, turmas anteriores, linha do tempo (histórico) e preferências de comunicação.
- Associado inativo mantém conta e histórico, perde as áreas operacionais.

## Etapa 3 — Manutenção (chamados e orçamentos)
- Chamados com fluxo completo: Aberto, Em análise, Aguardando orçamento, Orçamento recebido, Enviado ao financeiro, Em aprovação, Aprovado, Em execução, Concluído, mais Não aprovado, Postergado, Cancelado, Devolvido (com motivo obrigatório).
- Um ou mais orçamentos por chamado: fornecedor, valor, descrição, prazo, anexo, observações.
- Histórico visível de cada mudança de status com autor e data.

## Etapa 4 — Estoque planilha, Compras e Pedidos
- Estoque em estética de planilha, com edição rápida de quantidade na própria linha, unidade de controle (pacote/caixa/unidade + quantidade por embalagem) e alerta automático ao atingir o mínimo.
- Pedidos de compra: solicitante, itens, quantidades, justificativa, prioridade, status, vínculo com financeiro.
- Registro de compra: fornecedor, itens, valores, total, vários documentos/fotos por compra, vínculo com pedido, e baixa/entrada automática no estoque.
- Histórico de compras em planilha com filtros e exportação para arquivo de planilha.
- Leitura de nota por IA/OCR preenchendo apenas sugestões, sempre confirmadas por uma pessoa antes de gravar.

## Etapa 5 — Financeiro
- Fila única de aprovações: pedidos de compra e orçamentos de manutenção.
- Ações: aprovar, não aprovar, postergar, devolver (com motivo), tudo com histórico.
- Aprovação financeira tratada como permissão crítica.

## Etapa 6 — Áudios: descoberta, resumo e player mobile
- Biblioteca reordenada: Mais recentes, Em destaque (por plays contabilizados), Todos com busca e filtros.
- Busca por título, resumo, palavras-chave, trabalho e entidade, com exemplos sugeridos na barra.
- Resumo e palavras-chave gerados por IA após a transcrição, com briefing descritivo e fiel (sem interpretar, sem inventar; entidade nunca inferida pela IA).
- Sugestão automática de título a partir de entidade + trabalho + data, sempre editável.
- Cor por trabalho (definida pela administração) aplicada ao cartão do áudio + cadeado/badge de restrição com texto, nunca só cor.
- Player redesenhado para celular e transcrição colapsável em três estados (fechada, parcial, completa), fechada por padrão.
- Resumo, palavras-chave e transcrição herdam exatamente a política de acesso do áudio.

## Etapa 7 — Notificações, opções configuráveis e UX mobile
- Notificações internas com central no app para: estoque mínimo, novo pedido, aprovação pendente, novo chamado, transcrição aguardando revisão, novo cadastro, movimentos de turma.
- Preferências de comunicação por canal em Minha Conta (interno/e-mail/push já ligados; WhatsApp fica preparado no modelo).
- Listas configuráveis pela administração (categorias, unidades, tipos, status) com opção "Adicionar nova opção" reutilizável.
- Correção global do teclado virtual do iPhone cobrindo campos em diálogos e formulários.

## Fora desta rodada (dependem de serviço externo/custo)
Atalho do iPhone e bot de WhatsApp, e-mail/push reais e integração com Sheets. Serão planejados depois, dentro do limite de custo citado no documento, reaproveitando o mesmo pipeline de áudio.

## Decisões que assumo (avise se quiser diferente)
- Vínculo com turma: uma turma principal por período, com permissão de vínculos extras registrados separadamente quando a administração autorizar.
- Nível/turma nunca concede permissão operacional automaticamente.
- Exclusão definitiva de registros é permissão crítica; áreas operacionais usam arquivamento.

## Notas técnicas
Tudo em cima da arquitetura atual: uma única árvore de autorização (`roles`/`role_permissions`/`user_roles` + `has_permission`), regras aplicadas em RLS e nas server functions (não só na interface), Storage privado com URL assinada, `audit_logs` como histórico, e novas tabelas (`maintenance_tickets`, `maintenance_quotes`, `purchase_requests`, `purchases`, `purchase_documents`, `notifications`, `option_lists`, `audio_stats`) com GRANT + RLS por permissão. Sem sistema paralelo de permissões por módulo.
