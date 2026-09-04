import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/postagem/$id")({
  component: PostagemPage,
});

/* ---------- Renderização do conteúdo no estilo Substack ---------- */

function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|==[^=]+==|~[^~]+~)/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("==") && part.endsWith("==")) {
      return <mark key={index}>{part.slice(2, -2)}</mark>;
    }
    if (part.startsWith("~") && part.endsWith("~")) {
      return <small key={index}>{part.slice(1, -1)}</small>;
    }
    return part;
  });
}

function renderRichLines(content: string): ReactNode[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const alt = image[1] || "";
      blocks.push(
        <figure key={`img-${index}`} className="stack-figure">
          <img src={image[2]} alt={alt} loading="lazy" />
          {alt && <figcaption>{renderInline(alt)}</figcaption>}
        </figure>
      );
      return;
    }

    const custom = line.match(/^\[\[(pullquote|epigraph|dropcap|sidenote|caption|small)\]\](?:\s*)(.*)$/);
    if (custom) {
      const type = custom[1];
      const body = custom[2];

      if (type === "epigraph") {
        const dash = body.match(/^(.*?)\s*(?:—|--)\s*(.*)$/);
        const quote = dash ? dash[1].trim() : body;
        const source = dash ? dash[2].trim() : "";
        blocks.push(
          <figure key={`block-${index}`} className="stack-epigraph">
            <blockquote>{renderInline(quote)}</blockquote>
            {source && <figcaption>— {renderInline(source)}</figcaption>}
          </figure>
        );
        return;
      }

      if (type === "pullquote") {
        blocks.push(
          <blockquote key={`block-${index}`} className="stack-pullquote">
            {renderInline(body)}
          </blockquote>
        );
        return;
      }

      if (type === "dropcap") {
        blocks.push(
          <p key={`block-${index}`} className="stack-dropcap">
            {renderInline(body)}
          </p>
        );
        return;
      }

      if (type === "sidenote") {
        blocks.push(
          <aside key={`block-${index}`} className="stack-sidenote">
            <span className="stack-sidenote-label">Nota</span>
            <div>{renderInline(body)}</div>
          </aside>
        );
        return;
      }

      if (type === "caption") {
        blocks.push(
          <p key={`block-${index}`} className="stack-caption">
            {renderInline(body)}
          </p>
        );
        return;
      }

      if (type === "small") {
        blocks.push(
          <p key={`block-${index}`} className="stack-small">
            {renderInline(body)}
          </p>
        );
        return;
      }

      return;
    }

    if (line.startsWith(">")) {
      blocks.push(
        <blockquote key={`quote-${index}`} className="stack-quote border-l-4 border-brand/40 pl-5 py-2 my-8 italic text-muted-foreground/90 text-xl">
          {renderInline(line.replace(/^>\s?/, ""))}
        </blockquote>
      );
      return;
    }

    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) {
      blocks.push(<h1 key={`block-${index}`} className="mt-12 mb-6 font-display text-4xl font-bold leading-tight text-foreground">{renderInline(h1[1])}</h1>);
      return;
    }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      blocks.push(<h2 key={`block-${index}`} className="mt-10 mb-5 font-display text-3xl font-bold leading-tight text-foreground">{renderInline(h2[1])}</h2>);
      return;
    }
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      blocks.push(<h3 key={`block-${index}`} className="mt-8 mb-4 font-display text-2xl font-bold leading-snug text-foreground">{renderInline(h3[1])}</h3>);
      return;
    }

    const listItem = line.match(/^[-*]\s+(.*)$/);
    if (listItem) {
      blocks.push(
        <div key={`block-${index}`} className="mb-3 flex items-start pr-4 font-serif text-lg md:text-xl text-foreground/90 ml-2">
          <span className="mr-4 font-bold text-brand">•</span>
          <div className="flex-1">{renderInline(listItem[1])}</div>
        </div>
      );
      return;
    }

    blocks.push(<p key={`p-${index}`} className="mb-6 font-serif text-lg md:text-xl leading-relaxed text-foreground/90">{renderInline(line)}</p>);
  });

  return blocks;
}

function PostagemPage() {
  const { id } = Route.useParams();

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["site-posts", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_posts")
        .select(`
          id,
          title,
          subtitle,
          cover_image_url,
          content,
          published_at,
          status
        `)
        .eq("id", id)
        .eq("status", "published")
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .single();
      
      if (error || !data) throw error || new Error("Post não encontrado");
      
      return data;
    },
  });

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h1 className="font-display text-3xl font-bold text-foreground">Postagem não encontrada</h1>
          <p className="mt-2 text-muted-foreground">Esta publicação não existe, foi removida ou ainda não está publicada.</p>
          <Link to="/postagens" className="mt-6 flex items-center text-sm font-medium text-brand hover:underline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para as postagens
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      
      <main className="flex-1">
        {isLoading ? (
          <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
            <div className="h-16 w-3/4 animate-pulse rounded-xl bg-muted/40"></div>
            <div className="mt-6 h-6 w-1/2 animate-pulse rounded-md bg-muted/40"></div>
            <div className="mt-20 space-y-5">
              <div className="h-5 w-full animate-pulse rounded bg-muted/40"></div>
              <div className="h-5 w-full animate-pulse rounded bg-muted/40"></div>
              <div className="h-5 w-5/6 animate-pulse rounded bg-muted/40"></div>
              <div className="h-5 w-4/5 animate-pulse rounded bg-muted/40"></div>
            </div>
          </div>
        ) : post ? (
          <article className="stack-body mx-auto max-w-3xl px-6 py-16 sm:px-8 md:py-24">
            <div className="mb-12 text-center md:mb-16">
              <Link to="/postagens" className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-brand transition-colors hover:text-brand/80">
                <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                Postagens do site
              </Link>
            </div>

            {post.cover_image_url && (
              <figure className="stack-figure !mb-12 md:!-mx-12 overflow-hidden rounded-xl shadow-sm">
                <img src={post.cover_image_url} alt={post.title} className="w-full object-cover" />
              </figure>
            )}

            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-[52px] md:leading-[1.1]">
              {post.title}
            </h1>
            
            {post.subtitle && (
              <p className="stack-deck !mt-6 !text-[22px]">{post.subtitle}</p>
            )}

            <div className="my-12 flex items-center justify-between border-y border-border/40 py-5">
              <div className="flex items-center gap-3.5">
                <Avatar className="h-12 w-12 border border-border/50 shadow-xs">
                  <AvatarFallback className="bg-transparent font-serif text-foreground">
                    IF
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-sans text-[15px] font-semibold text-foreground">
                    Instituto Fraternidade
                  </p>
                  <p className="text-[13px] text-muted-foreground capitalize">
                    {post.published_at ? format(new Date(post.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Ainda não publicada"}
                  </p>
                </div>
              </div>
            </div>

            <div className="stack-content">
              {post.content ? (
                renderRichLines(post.content)
              ) : (
                <p className="font-serif text-lg italic text-muted-foreground">Esta postagem não possui conteúdo no momento.</p>
              )}
            </div>
          </article>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
