import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/site/SiteLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/postagens")({
  head: () => ({
    meta: [
      { title: "Postagens — Instituto Fraternidade" },
      { name: "description", content: "Reflexões, orações e textos inspiradores." },
    ],
  }),
  component: PostagensPage,
});

function contentExcerpt(raw: string): string {
  let excerpt = raw
    .replace(/^!\[([^\]]*)\]\([^)]*\)$/gm, "")
    .replace(/^\[\[(pullquote|epigraph|dropcap|sidenote|caption|small)\]\]\s?/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/(\*\*|==|~)/g, "")
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  
  if (excerpt.length > 250) {
    excerpt = excerpt.substring(0, 250).trim() + "...";
  }
  return excerpt;
}

function PostagensPage() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["site-posts", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_posts")
        .select(`
          id,
          title,
          subtitle,
          cover_image_url,
          content,
          published_at
        `)
        .eq("status", "published")
        .not("published_at", "is", null)
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-28">
          <header className="mb-16 text-center border-b border-border/40 pb-12">
            <p className="text-xs uppercase tracking-[0.22em] text-brand font-semibold">
              Biblioteca
            </p>
            <h1 className="mt-4 font-display text-4xl text-foreground font-bold tracking-tight md:text-5xl">
              Postagens
            </h1>
            <p className="mx-auto mt-5 max-w-lg font-serif text-[19px] leading-relaxed text-muted-foreground/90">
              Reflexões, mensagens e orações abertas a todos para leitura, inspiração e convívio diário.
            </p>
          </header>

          <div className="space-y-16">
            {isLoading && (
              <div className="py-12 text-center text-muted-foreground animate-pulse font-serif text-lg">
                Carregando publicações...
              </div>
            )}
            
            {!isLoading && posts?.length === 0 && (
              <div className="py-20 text-center opacity-80">
                <p className="font-display text-2xl font-medium text-foreground">Nenhum registro ainda</p>
                <p className="mx-auto mt-3 max-w-sm font-serif text-lg text-muted-foreground">
                  As postagens em breve estarão disponíveis neste mural.
                </p>
              </div>
            )}

            {posts?.map((post) => {
              const authorName = "Instituto Fraternidade";
              const displayDate = post.published_at ? new Date(post.published_at) : new Date();
              const excerpt = post.content ? contentExcerpt(post.content) : "";

              return (
                <article key={post.id} className="group flex flex-col gap-5 md:gap-7">
                  {post.cover_image_url && (
                    <Link 
                      to={`/postagem/$id`} 
                      params={{ id: post.id }} 
                      className="block overflow-hidden rounded-[20px] border border-border/40 shadow-sm transition-transform duration-500 hover:-translate-y-1"
                    >
                      <img 
                        src={post.cover_image_url} 
                        alt={post.title} 
                        className="max-h-[360px] w-full object-cover" 
                        loading="lazy" 
                      />
                    </Link>
                  )}
                  
                  <div className="space-y-3 pt-2">
                    <Link to={`/postagem/$id`} params={{ id: post.id }}>
                      <h2 className="font-display text-[28px] font-bold tracking-tight text-foreground transition-colors group-hover:text-brand md:text-[34px] md:leading-tight">
                        {post.title}
                      </h2>
                    </Link>
                    
                    {post.subtitle && (
                      <p className="font-serif text-[20px] italic text-muted-foreground/90">
                        {post.subtitle}
                      </p>
                    )}
                    
                    {excerpt && (
                      <p className="line-clamp-3 font-serif text-[17px] leading-relaxed text-foreground/80 mt-2">
                        {excerpt}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-3">
                    <Avatar className="h-10 w-10 border border-border/50 shadow-xs">
                      
                      <AvatarFallback className="bg-transparent font-serif text-foreground">
                        {authorName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <p className="font-sans text-[14px] font-semibold text-foreground">{authorName}</p>
                      <p className="text-[13px] text-muted-foreground capitalize">
                        {format(displayDate, "d 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
