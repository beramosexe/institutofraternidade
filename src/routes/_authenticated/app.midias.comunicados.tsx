import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/midias/comunicados")({
  beforeLoad: () => { throw redirect({ to: "/app/midias/redes" }); },
  head: () => ({
    meta: [
      { title: "Comunicados — Instituto Fraternidade" },
      { name: "description", content: "Prepare comunicados enviados por WhatsApp e outros canais de comunicação." },
      { property: "og:title", content: "Comunicados — Instituto Fraternidade" },
      { property: "og:description", content: "Prepare comunicados enviados por WhatsApp e outros canais de comunicação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunicationsPage,
});

const PLATFORMS = ["whatsapp", "email", "telegram"];

function CommunicationsPage() {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["whatsapp"]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["communications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communications")
        .select("id, message, platforms, status, sent_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("communications").insert({ message, platforms, status: "draft" });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      toast.success("Comunicado salvo.");
      qc.invalidateQueries({ queryKey: ["communications"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar comunicado."),
  });

  const markSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("communications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communications"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("communications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["communications"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir."),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-brand">Mídias</p>
        <h1 className="mt-1 font-display text-3xl text-foreground">Comunicados</h1>
        <p className="mt-1 text-muted-foreground">
          Mensagens para os canais de comunicação da casa (WhatsApp e outros).
        </p>
      </div>

      <Card className="space-y-3 p-5">
        <Textarea rows={4} placeholder="Mensagem do comunicado" value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={platforms.includes(p) ? "default" : "outline"}
              onClick={() =>
                setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
              }
            >
              {p}
            </Button>
          ))}
        </div>
        <Button disabled={!message.trim() || create.isPending} onClick={() => create.mutate()}>
          Salvar comunicado
        </Button>
      </Card>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {items?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comunicado ainda.</p>}
        {items?.map((c) => (
          <Card key={c.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm text-foreground">{c.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(c.platforms ?? []).map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                ))}
                <Badge variant={c.status === "sent" ? "default" : "secondary"}>
                  {c.status === "sent" ? "Enviado" : "Rascunho"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              {c.status !== "sent" && (
                <Button size="sm" variant="outline" onClick={() => markSent.mutate(c.id)}>
                  Marcar como enviado
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>Excluir</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
