# Biblioteca de áudios + menu de ferramentas

Três frentes: a aba de áudios ganha cara de biblioteca/feed, o menu lateral do app passa a se ler como "painel de ferramentas" (e não como a barra do site), e o mobile deixa de desperdiçar espaço.

## 1. Aba de áudios como biblioteca

Hoje cada áudio é um cartão largo com resumo de 3 linhas, badges empilhadas à direita e a lista aparece três vezes (Recentes, Destaques, Todos) — muito scroll para poucos itens.

Mudanças:
- **Cabeçalho compacto**: título + subtítulo em uma faixa menor; no mobile só o título e o campo de busca.
- **Barra de filtros colapsável**: no mobile fica só a busca + um botão "Filtros" que abre uma folha com trabalho/tipo/acesso/palavras-chave. No desktop os filtros seguem na linha, mas em uma barra fina (sem card grande).
- **Grid de "posts"**: cards menores em grade — 1 coluna no mobile (linhas densas), 2 em tablet, 3 no desktop. Resumo em 2 linhas, palavras-chave limitadas a 3 com "+N".
- **Faixa horizontal de destaques**: "Recentes" e "Destaques" viram carrosséis horizontais com cards estreitos (rolagem lateral, ótimo no mobile), e abaixo fica a grade "Todos os áudios" com o contador.
- **Alternador lista/grade** no desktop, para quem prefere varredura densa.
- Metadados do card viram uma linha só: data · duração · reproduções, com ícones. Selo de acesso restrito passa a ser um ícone discreto no canto, não um badge de texto largo.

## 2. Logo no mobile

O componente `Logo` já tem a variante `mark` (só o emblema). No cabeçalho mobile do app passamos a usar só o ícone (`variant="mark"`, ~32px) ao lado de um rótulo curto "Ferramentas", liberando largura para o botão de menu e futuros atalhos.

## 3. Menu lateral como "menu de ferramentas"

Para diferenciar visualmente do menu do site:
- Cabeçalho próprio da barra: ícone + "Ferramentas" e o nome do associado logo abaixo, sobre um fundo levemente mais escuro que o conteúdo.
- Cada seção ganha uma faixa com um filete colorido à esquerda usando a cor já definida por área (áudios azul, acolhimento verde, estoque âmbar etc.), em vez de só texto colorido.
- **Espaçamento corrigido**: itens mais compactos (altura ~36px no desktop, 44px no mobile), respiro maior *entre* seções e menor *dentro* delas; títulos de seção menores, com mais contraste.
- Item ativo passa a ter marcador lateral (barra na cor da seção) além do fundo, deixando claro onde você está.
- No mobile o drawer abre pela esquerda com o mesmo cabeçalho "Ferramentas", reforçando que é um painel de trabalho.

## Detalhes técnicos

- `src/components/app/AudioCard.tsx`: nova prop `variant` (`grid` | `row` | `compact`) para reaproveitar o card nos carrosséis e na grade; remove a coluna direita de badges no modo grid.
- `src/routes/_authenticated/app.audios.index.tsx`: reorganiza em faixas + grade, filtros em `Sheet` no mobile, estado de visualização (grade/lista) em `useState`.
- `src/components/app/AppShell.tsx`: novo cabeçalho da sidebar, seções com filete colorido (cor por seção movida para token/classe única), espaçamentos revistos, drawer mobile à esquerda, `Logo variant="mark"` no header mobile.
- `src/styles.css`: tokens de cor por área (`--area-audios`, `--area-acolhimento`, …) para os filetes, em vez de classes Tailwind soltas.
- Sem mudanças de dados, permissões ou consultas — apenas apresentação.
