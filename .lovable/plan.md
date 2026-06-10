## Problema

Ao clicar em um áudio na biblioteca (`/app/audios`), a URL muda para `/app/audios/<id>` mas a tela continua mostrando a lista. Não tem relação com status da transcrição nem com lentidão do servidor.

## Causa

No TanStack Router, com a convenção de pontos:

- `src/routes/_authenticated/app.audios.tsx` define a rota `/app/audios` (a biblioteca).
- `src/routes/_authenticated/app.audios.$id.tsx` define `/app/audios/$id` (o detalhe).

Por causa do prefixo comum `app.audios.`, o route tree gerado registra o **detalhe como filho da biblioteca** (confirmado em `src/routeTree.gen.ts`: `parentRoute: typeof AuthenticatedAppAudiosRoute`). Quando uma rota é pai, seu componente precisa renderizar `<Outlet />` para o filho aparecer — e a biblioteca não renderiza Outlet, ela renderiza a listagem inteira. Por isso o filho casa, mas nunca monta.

## Correção

Renomear a página da biblioteca para um leaf `index` (padrão TanStack) e criar um layout vazio só com `<Outlet />`:

1. `mv src/routes/_authenticated/app.audios.tsx src/routes/_authenticated/app.audios.index.tsx`
   - Ajustar `createFileRoute("/_authenticated/app/audios")` para `createFileRoute("/_authenticated/app/audios/")`.
2. Criar `src/routes/_authenticated/app.audios.tsx` apenas como layout:
   ```tsx
   import { createFileRoute, Outlet } from "@tanstack/react-router";
   export const Route = createFileRoute("/_authenticated/app/audios")({
     component: () => <Outlet />,
   });
   ```

O Vite plugin regenera `routeTree.gen.ts` automaticamente. Após isso:
- `/app/audios` continua mostrando a biblioteca (via leaf `index`).
- `/app/audios/<id>` monta o detalhe dentro do `<Outlet />` do layout.

## Verificação

- Clicar num card na biblioteca → URL muda E a tela do detalhe carrega.
- Funciona tanto para áudios com status `ready` quanto `transcribing` (o detalhe já mostra "Transcrevendo automaticamente…" quando não está pronto).