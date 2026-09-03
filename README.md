# Fraternidade Audio Hub

Crie um site institucional completo para o Instituto Fraternidade, com foco inicial em uma área funcional para disponibilização, organização, transcrição e consumo de áudios gravados nos trabalhos do Instituto.

O site deve ter uma identidade visual serena, espiritualista, institucional, limpa e confiável, sem parecer religioso demais ou amador. Use uma estética acolhedora, com cores suaves, boa legibilidade, aparência moderna, responsiva e mobile-first.

Estruture o projeto com banco de dados unificado, não disperso, já preparado para integrações futuras entre site institucional, associados, agenda, trabalhos, presença/check-in, canalizações, transcrições, permissões e logs.

Crie as seguintes áreas principais:

Site institucional público:

Página inicial com apresentação do Instituto Fraternidade.

Página “Quem somos”.

Página “Trabalhos” ou “Agenda”.

Página pública de áudios/canalizações, exibindo apenas conteúdos marcados como públicos.

Página de contato.

Layout responsivo para celular, tablet e desktop.

Sistema de login e perfis:
Crie autenticação com diferentes tipos de usuário:

Visitante público: acessa apenas conteúdo público.

Associado: acessa conteúdos restritos aos associados.

Participante de trabalho: acessa conteúdos vinculados aos trabalhos dos quais participou.

Associado autorizado para upload: pode cadastrar e enviar áudios.

Administrador: gerencia tudo.

Área de associados:

Dashboard simples para o associado.

Lista de áudios disponíveis para ele.

Filtros por trabalho, data, tipo de áudio e origem da mensagem.

Player de áudio embutido.

Visualização da transcrição.

Busca por palavras na transcrição.

Interface limpa, simples e intuitiva.

Módulo de trabalhos/agenda:
Crie uma tabela de “Trabalhos” que alimente tanto a agenda pública quanto o upload dos áudios.
Cada trabalho deve conter:

Nome do trabalho.

Descrição.

Data e horário.

Local.

Status: publicado, rascunho, concluído ou arquivado.

Visibilidade pública ou interna.

Quando um novo trabalho for cadastrado na agenda, ele deve aparecer automaticamente como opção de seleção no cadastro de um novo áudio.

Módulo de upload de áudios:
Crie uma área para usuários autorizados enviarem gravações.
O formulário de upload deve conter:

Upload do arquivo de áudio.

Seleção do trabalho em que foi gravado.

Data da gravação.

Tipo do áudio: Canalização ou Outro.

Campo “Mensagem de quem”, para informar ou selecionar a origem/autoria espiritual da mensagem.

Título do áudio.

Descrição opcional.

Nível de acesso:

Público geral.

Restrito aos associados.

Restrito aos participantes daquele trabalho específico.

Disponível apenas aos presentes no dia, para uso futuro quando houver check-in.

Data de disponibilização preenchida automaticamente.

Usuário que disponibilizou preenchido automaticamente.

Status do processamento: enviado, convertendo, transcrevendo, pronto ou erro.

Após o upload, o sistema deve prever automaticamente:

Conversão do áudio para um formato mais leve e compatível com reprodução web, como MP3 ou AAC.

Geração de uma versão otimizada para streaming.

Transcrição automática do áudio.

Salvamento do arquivo original e da versão convertida.

Exibição da transcrição junto ao player.

Caso o Lovable não consiga executar diretamente conversão e transcrição, deixe a estrutura preparada para integração via Supabase Edge Functions, API externa, webhook ou serviço como Whisper/OpenAI, AssemblyAI ou equivalente.

Biblioteca de áudios:
Crie uma tela administrativa e uma tela para usuário final.
Cada áudio deve exibir:

Título.

Trabalho relacionado.

Data da gravação.

Data da disponibilização.

Tipo do áudio.

Mensagem de quem.

Quem disponibilizou.

Nível de acesso.

Player.

Transcrição.

Status de processamento.

Botões de editar, arquivar, republicar ou excluir, apenas para usuários autorizados.

Inclua filtros por:

Trabalho.

Data.

Tipo de áudio.

Origem da mensagem.

Nível de acesso.

Status de processamento.

Controle de permissões:
Implemente regras claras de acesso:

Áudio público aparece para qualquer visitante.

Áudio restrito aos associados aparece apenas para usuários associados logados.

Áudio restrito aos participantes daquele trabalho aparece apenas para usuários vinculados ao trabalho.

Áudio disponível aos presentes no dia deve ficar preparado para funcionar futuramente com check-in.

Administrador vê tudo.

Usuário autorizado para upload vê os próprios uploads e, se permitido, os conteúdos do seu grupo.

Futuro módulo de presença/check-in:
Mesmo que não seja usado na primeira versão, crie a estrutura de banco para:

Registrar presença de associados em trabalhos.

Vincular usuário, trabalho, data e horário do check-in.

Permitir que futuramente áudios sejam liberados apenas para quem esteve presente naquele dia.

Logs e auditoria:
Crie registro automático de ações importantes:

Quem fez upload.

Quem editou.

Quem alterou nível de acesso.

Quem excluiu ou arquivou.

Data e hora das ações.

Status de processamento do áudio.

Erros de transcrição ou conversão.

Banco de dados:
Use uma estrutura organizada, preferencialmente com Supabase, contendo tabelas como:

users / profiles

associates

works

audios

audio_transcriptions

attendance

access_permissions

upload_logs

processing_jobs

Garanta que o banco seja unificado e preparado para cruzamento entre módulos.

Experiência do usuário:
A navegação deve ser extremamente simples.
O usuário associado deve conseguir:

Entrar.

Ver os áudios disponíveis.

Dar play.

Ler a transcrição.

Filtrar por trabalho ou data.

O usuário autorizado deve conseguir:

Subir um áudio.

Preencher os campos.

Acompanhar o status do processamento.

Ver quando o conteúdo estiver pronto.

O administrador deve conseguir:

Gerenciar usuários.

Gerenciar trabalhos.

Gerenciar áudios.

Gerenciar permissões.

Ver logs.

Segurança:
Inclua proteção por autenticação, controle por perfil de usuário, validação de arquivos enviados, limite de tamanho de upload, tratamento de erros e proteção para que usuários não acessem áudios sem permissão.

Entregue a primeira versão com:

Layout institucional completo.

Login.

Dashboard de associado.

Cadastro de trabalhos.

Upload de áudio.

Biblioteca de áudios.

Player.

Campo de transcrição.

Estrutura preparada para conversão e transcrição automática.

Permissões por nível de acesso.

Banco de dados unificado.

Estrutura preparada para check-in futuro.

Priorize funcionalidade real, clareza de fluxo, organização de dados e possibilidade de expansão futura. Não crie apenas telas estáticas; crie uma aplicação funcional, com dados conectados, permissões e estrutura lógica consistente.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/861068a3-f0e7-428b-acf2-bc5457dc2cf2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
