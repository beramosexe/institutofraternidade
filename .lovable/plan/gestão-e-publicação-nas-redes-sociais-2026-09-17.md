# Gestão e publicação nas redes sociais

## Objetivo
Transformar a página atual em uma central simples para preparar, aprovar, agendar e publicar conteúdos no Instagram e Facebook, incluindo lembretes gerados a partir dos trabalhos do Instituto.

## O que será construído

### 1. Central de postagens
- Organizar as postagens por **Rascunho**, **Aguardando aprovação**, **Agendada**, **Publicada** e **Com erro**.
- Criar e editar texto, imagem, redes de destino, data e horário.
- Permitir duplicar, excluir, aprovar, cancelar agendamento e tentar novamente.
- Exibir uma prévia compacta para Instagram e Facebook e o retorno da publicação em cada rede.
- Manter o acesso restrito a quem possui a permissão de Mídias.

### 2. Lembretes automáticos dos trabalhos
- Acrescentar, em cada trabalho, uma configuração opcional de divulgação.
- Permitir escolher quantos lembretes serão criados e quanto tempo antes de cada ocorrência.
- Definir texto-base, imagem, redes e modo de envio por trabalho.
- No modo **manual**, gerar rascunhos para aprovação.
- No modo **automático**, agendar diretamente conforme o modelo aprovado.
- Tratar trabalhos únicos e semanais sem criar lembretes duplicados.

### 3. Publicação oficial pela Meta
- Preparar a conexão segura com a Página do Facebook e a conta profissional do Instagram vinculada.
- Publicar por meio da API oficial da Meta, sem expor credenciais no navegador.
- Registrar identificadores, horário, resultado e mensagem de erro separadamente por rede.
- Receber e validar retornos da Meta quando necessário.
- Oferecer uma tela simples para conectar, verificar e desconectar as contas.

### 4. Execução dos agendamentos
- Criar um processo seguro que identifica publicações vencidas e envia somente as aprovadas.
- Impedir reenvios acidentais e manter tentativas controladas em caso de falha temporária.
- Registrar o histórico de geração, aprovação, publicação e falhas.

### 5. Verificação
- Testar criação manual, edição, aprovação e filtros.
- Testar lembretes de trabalho único e recorrente.
- Testar publicação separada e simultânea no Instagram e Facebook.
- Conferir celular e computador, permissões, mensagens de erro e estado final do preview.

## Dependência externa
As contas já existem, mas a publicação só poderá ser ativada depois de confirmar que o Instagram é profissional, está vinculado a uma Página e ambos estão em um Meta Business. Também será necessário criar/configurar um aplicativo na Meta e conceder as permissões oficiais de publicação; até essa autorização, toda a central e os agendamentos poderão funcionar em modo de preparação.

## Detalhes técnicos
- Ampliar os dados de postagens para mídia, aprovação, origem do trabalho, tentativas e resultados por canal.
- Criar configurações e ocorrências de lembretes com regras de acesso restritas.
- Usar funções protegidas no servidor para autenticação e chamadas à Meta.
- Usar uma rota pública dedicada apenas para callbacks verificados e outra execução protegida para o agendador.
- Guardar tokens e segredos somente no ambiente seguro do projeto.
