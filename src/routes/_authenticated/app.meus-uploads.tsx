import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AUDIO_STATUS_LABELS } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/app/meus-uploads")({
  component: MyUploads,
});

function MyUploads() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-uploads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("audios")
        .select("id, title, status, published_at, audio_type, audio_transcriptions(review_status)")
        .eq("uploaded_by", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Disponibilizar</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Meus uploads</h1>
      </div>
      <div className="grid gap-3">
        {isLoading ? <p className="text-muted-foreground">Carregando…</p> :
         (data?.length ?? 0) === 0 ? <Card className="p-8 text-center text-muted-foreground">Você ainda não enviou áudios.</Card> :
         data?.map((a) => {
           const t = Array.isArray(a.audio_transcriptions) ? a.audio_transcriptions[0] : a.audio_transcriptions;
           return (
             <Link key={a.id} to="/app/audios/$id" params={{ id: a.id }}>
               <Card className="p-5 transition-colors hover:bg-accent/30">
                 <div className="flex flex-wrap items-center justify-between gap-3">
                   <div>
                     <p className="font-medium text-foreground">{a.title}</p>
                     <p className="text-xs text-muted-foreground">
                       {a.published_at ? format(new Date(a.published_at), "d MMM yyyy", { locale: ptBR }) : ""}
                     </p>
                   </div>
                   <div className="flex flex-wrap gap-2">
                     <Badge variant="outline">{AUDIO_STATUS_LABELS[a.status]}</Badge>
                     {t && (
                       <Badge variant="outline">
                         Transcrição: {t.review_status === "reviewed" ? "Revisada" : "Não revisada"}
                       </Badge>
                     )}
                   </div>
                 </div>
               </Card>
             </Link>
           );
         })}
      </div>
    </div>
  );
}
