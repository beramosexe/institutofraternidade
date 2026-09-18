# Reorganização da Central de Comunicações

## Objetivo
Unificar postagens e comunicados em uma única central multicanal, mantendo **Postagens do site** como área editorial separada. Reaproveitar o envio para Instagram/Facebook, os agendamentos, o histórico por canal, as permissões e os vínculos com trabalhos já existentes.

## Experiência final

### Publicação independente
```text
Criar → escrever → escolher canais → escolher quando → agendar
```
- Campos: nome interno, texto, imagem, canais e data/hora.
- Tipo **pontual** ou **recorrente**.
- Recorrência em linguagem humana, como “toda quarta-feira às 19h”.
- A recorrência poderá ter uma data final ou ficar **sem término**.

### Comunicação de um trabalho
```text
Criar/editar trabalho → configurar avisos → sistema agenda e acompanha
```
- Cada trabalho poderá ter vários avisos independentes.
- Prazo informado como quantidade + unidade: “7 dias antes”, “1 hora antes”.
- Cada aviso terá seus próprios canais, texto, imagem e modo de aprovação.
- Alterações futuras no horário do trabalho recalcularão somente comunicações ainda não enviadas.

## Implementação

### 1. Modelo central e migração segura
- Evoluir a estrutura robusta de postagens existente para representar qualquer comunicação, sem criar uma segunda integração paralela.
- Manter e ampliar o histórico de entrega por canal já existente.
- Migrar os comunicados atuais e preservar postagens, estados, vínculos e histórico existentes.
- Substituir a configuração única de avisos de cada trabalho por várias regras independentes.
- Separar os conceitos de:
  - **canal**: Instagram, Facebook, WhatsApp e futuros;
  - **destino**: conta social, grupo, lista ou contato;
  - **origem**: publicação independente, aviso de trabalho, adiamento, cancelamento ou alerta operacional;
  - **programação**: pontual, recorrente ou automática por trabalho.
- Preparar campos opcionais para template, referência visual e instrução estética, sem implementar geração por IA agora.
- Preservar as regras atuais de acesso para administradores e pessoas com permissão de Mídias.

### 2. Central de Comunicações em tabela
- Substituir as páginas separadas de **Redes sociais** e **Comunicados** por uma única entrada no menu: **Central de Comunicações**.
- Exibir tabela adaptável a celular com: publicação/comunicado, nome interno, trabalho, canais, envio, tipo, status e ações.
- Incluir busca e filtros por status, canal, tipo e trabalho.
- Manter ações úteis já existentes: editar, duplicar, aprovar, publicar, tentar novamente e excluir quando permitido.
- Exibir o resultado de cada canal separadamente, inclusive erros e horários de entrega.
- Redirecionar os endereços antigos para a nova central, preservando links já usados.

### 3. Criação simples de publicações
- Reformular o formulário com somente termos compreensíveis ao usuário.
- Trocar minutos e variáveis técnicas por seletores de quantidade/unidade e controles de recorrência.
- Para recorrência semanal, oferecer dia da semana, horário e término opcional.
- Gerar as próximas ocorrências sem duplicidade; novas ocorrências continuam sendo materializadas pelo agendador.
- Validar exigências por canal, como imagem obrigatória no Instagram e modelo aprovado/destino no WhatsApp.

### 4. Avisos dentro de Trabalhos
- Levar a configuração de avisos para a criação/edição do próprio trabalho.
- Permitir adicionar, editar, ordenar e remover vários avisos.
- Mostrar exemplos humanos do horário calculado antes de salvar.
- Centralizar o cálculo de ocorrências para ser usado igualmente pela agenda, pelos avisos e pelos reagendamentos.

### 5. Adiar e cancelar na fonte da verdade
- Adicionar ações explícitas **Adiar** e **Cancelar** na área de Trabalhos.
- Em trabalhos semanais, perguntar se a ação vale para a próxima ocorrência ou para toda a série.
- Registrar exceções por ocorrência, pois hoje um único registro representa toda a série.
- Ao adiar:
  - atualizar a ocorrência ou série escolhida;
  - cancelar os agendamentos futuros antigos;
  - recalcular os novos horários;
  - criar um comunicado de adiamento nos canais configurados.
- Ao cancelar:
  - marcar a ocorrência ou série escolhida;
  - cancelar comunicações futuras sem sentido;
  - criar um comunicado de cancelamento.
- Nunca alterar comunicações já publicadas e nunca sobrescrever silenciosamente conteúdo manual; versões substituídas ficam registradas.

### 6. Entrega por canais
- Manter a integração Meta existente para Instagram e Facebook, apenas adaptando-a ao modelo central.
- Conectar o WhatsApp Business do Instituto pelo conector oficial e implementar envio automático.
- Criar uma estrutura de destinos reutilizável para:
  - grupos em que a conta esteja incluída, quando a conexão/API utilizada disponibilizar esses destinos;
  - listas de contatos;
  - contatos específicos para alertas operacionais futuros.
- Para WhatsApp, incluir modelos aprovados, registro do identificador de envio e acompanhamento de enviado/entregue/lido/erro.
- Criar o receptor seguro de retornos do WhatsApp e uma caixa durável de eventos para não perder confirmações.
- Manter a configuração de destinatários operacionais desacoplada da Central; estoque e outras áreas poderão reutilizar o mesmo serviço no futuro.
- Se a conta conectada não expuser grupos para envio automatizado, a arquitetura permanecerá pronta e a interface mostrará apenas destinos realmente disponíveis, sem simular suporte.

### 7. Agendador e consistência
- Reaproveitar o executor atual, ampliando-o para despachar por adaptadores de canal.
- Proteger contra envio duplicado e concorrente.
- Executar recorrências independentes, avisos de trabalho e comunicações de alteração/cancelamento.
- Controlar tentativas por canal e manter falhas isoladas: um erro no WhatsApp não impede Facebook ou Instagram.

### 8. Preparação para IA
- Criar modelos de comunicação reutilizáveis, por exemplo “Aviso de trabalho”, “Adiamento” e “Cancelamento”.
- Cada modelo poderá guardar texto orientador, referência visual, instrução estética e canais sugeridos.
- Definir um ponto único de geração futura que receberá dados do trabalho + modelo + referência, permitindo adicionar texto e arte por IA sem mudar o fluxo nem os registros.

## Verificação
- Conferir a migração dos registros existentes antes de retirar as páginas antigas.
- Testar publicação pontual e recorrente, com e sem data final.
- Testar múltiplos avisos no mesmo trabalho e recálculo após mudança de horário.
- Testar adiamento/cancelamento de uma ocorrência e de uma série semanal.
- Testar sucesso e falha independentes em Instagram, Facebook e WhatsApp.
- Validar tabela e formulários em computador e celular, permissões e ausência de duplicidades.

## Dependências externas
- A publicação real no Instagram/Facebook continua dependendo da autorização das contas Meta já prevista.
- O WhatsApp Business ainda não está conectado ao projeto. A implementação exigirá conectar a conta, definir o projeto como destino dos retornos e ter modelos aprovados pela Meta para mensagens iniciadas pelo Instituto.
- A disponibilidade de envio para grupos será validada com a conta e a interface oficial conectadas; listas e contatos específicos já serão previstos no modelo de dados.

## Ordem de entrega
1. Migração e central unificada, preservando os dados atuais.
2. Formulário simples e recorrência independente.
3. Avisos dentro de Trabalhos, exceções, adiamento e cancelamento.
4. Adaptadores de canais e agendador consolidado.
5. Conexão e validação completa do WhatsApp Business.
6. Estrutura de templates e referências para IA futura.
