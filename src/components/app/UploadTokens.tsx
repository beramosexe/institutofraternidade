import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Loader2, Smartphone, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { listMyUploadTokens, createUploadToken, revokeUploadToken } from "@/lib/upload-tokens.functions";
import { ACCESS_LEVEL_LABELS } from "@/lib/permissions";

const NONE = "__none__";

export function UploadTokens() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyUploadTokens);
  const createFn = useServerFn(createUploadToken);
  const revokeFn = useServerFn(revokeUploadToken);

  const [label, setLabel] = useState("Meu iPhone");
  const [access, setAccess] = useState<"public" | "associates" | "work_participants" | "attendees_only">("associates");
  const [workId, setWorkId] = useState(NONE);
  const [fresh, setFresh] = useState<string | null>(null);

  const { data: tokens = [], isLoading } = useQuery({ queryKey: ["upload-tokens"], queryFn: () => listFn() });
  const { data: works } = useQuery({
    queryKey: ["works-options"],
    queryFn: async () => (await supabase.from("works").select("id, name").order("starts_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({ data: { label: label.trim(), default_access_level: access, default_work_id: workId === NONE ? null : workId } }),
    onSuccess: (r) => {
      setFresh(r.token);
      qc.invalidateQueries({ queryKey: ["upload-tokens"] });
      toast.success("Token criado. Copie agora — ele não será exibido novamente.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar token"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["upload-tokens"] }); toast.success("Token revogado."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao revogar"),
  });

  const endpoint = `${typeof window === "undefined" ? "" : window.location.origin}/api/public/audio-upload`;

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 text-brand" />
        <div>
          <h2 className="font-display text-xl text-foreground">Enviar pelo iPhone (Atalho)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie um token pessoal e configure um Atalho no iPhone que envie a gravação direto
            para a biblioteca. A transcrição inicia automaticamente.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="tk-label">Nome do dispositivo</Label>
          <Input id="tk-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} />
        </div>
        <div>
          <Label>Acesso padrão</Label>
          <Select value={access} onValueChange={(v) => setAccess(v as typeof access)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ACCESS_LEVEL_LABELS) as Array<keyof typeof ACCESS_LEVEL_LABELS>).map((k) => (
                <SelectItem key={k} value={k}>{ACCESS_LEVEL_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Trabalho padrão</Label>
          <Select value={workId} onValueChange={setWorkId}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nenhum</SelectItem>
              {works?.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={() => create.mutate()} disabled={create.isPending || !label.trim()}>
        {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Criar token
      </Button>

      {fresh && (
        <div className="space-y-3 rounded-md border border-gold/40 bg-gold/10 p-4">
          <p className="text-sm font-medium text-foreground">Seu token (copie agora):</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-background px-2 py-1 text-xs">{fresh}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(fresh); toast.success("Token copiado."); }}>
              <Copy className="mr-1 h-3 w-3" /> Copiar
            </Button>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Como configurar o Atalho:</p>
            <p>1. Atalhos → novo atalho → ação “Obter conteúdo de URL”.</p>
            <p>2. URL: <code className="break-all">{endpoint}</code></p>
            <p>3. Método: POST · Solicitar: Formulário</p>
            <p>4. Cabeçalho <code>x-upload-token</code> com o token acima.</p>
            <p>5. Campos do formulário: <code>file</code> (o arquivo de áudio) e, opcionalmente, <code>title</code>, <code>recorded_at</code> (AAAA-MM-DD), <code>work_id</code>, <code>access_level</code>.</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando tokens…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum token criado ainda.</p>
        ) : tokens.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
            <div className="min-w-0">
              <p className="text-sm text-foreground">
                {t.label} <code className="ml-1 text-xs text-muted-foreground">{t.token_prefix}…</code>
              </p>
              <p className="text-xs text-muted-foreground">
                {ACCESS_LEVEL_LABELS[t.default_access_level]} · {t.use_count} envios
                {t.last_used_at ? ` · último em ${new Date(t.last_used_at).toLocaleString("pt-BR")}` : ""}
              </p>
            </div>
            {t.revoked_at ? (
              <Badge variant="outline">Revogado</Badge>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => revoke.mutate(t.id)}>
                <Trash2 className="mr-1 h-3 w-3" /> Revogar
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
