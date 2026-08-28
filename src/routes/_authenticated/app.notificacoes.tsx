import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getMyNotificationPreferences, listMyNotifications, markNotificationRead,
  updateMyNotificationPreferences,
} from "@/lib/notifications.functions";

export const Route = createFileRoute("/_authenticated/app/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Instituto Fraternidade" },
      { name: "description", content: "Central de notificações internas do Instituto Fraternidade e preferências de aviso." },
      { property: "og:title", content: "Notificações — Instituto Fraternidade" },
      { property: "og:description", content: "Avisos internos e preferências de notificação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function NotificationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNotifications);
  const readFn = useServerFn(markNotificationRead);
  const prefsFn = useServerFn(getMyNotificationPreferences);
  const savePrefsFn = useServerFn(updateMyNotificationPreferences);

  const { data: items, isLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => listFn(), retry: false });
  const { data: prefs } = useQuery({ queryKey: ["notification-prefs"], queryFn: () => prefsFn(), retry: false });

  const markRead = useMutation({
    mutationFn: (v: { id?: string; all?: boolean }) => readFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePrefs = useMutation({
    mutationFn: (v: Record<string, boolean>) => savePrefsFn({ data: v }),
    onSuccess: () => {
      toast.success("Preferências salvas.");
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unread = (items ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Notificações</h1>
          <p className="text-sm text-muted-foreground">Avisos internos das áreas em que você atua.</p>
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" className="gap-2" onClick={() => markRead.mutate({ all: true })}>
            <CheckCheck className="h-4 w-4" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (items ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
          <Bell className="h-6 w-6" /> Nenhuma notificação por aqui.
        </Card>
      ) : (
        <div className="space-y-2">
          {(items ?? []).map((n) => (
            <Card key={n.id} className={`p-4 ${n.read_at ? "" : "border-primary/40 bg-accent/30"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{n.title}</div>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <div className="mt-1 text-xs text-muted-foreground">{dt(n.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!n.read_at && <Badge>Nova</Badge>}
                  {n.link && (
                    <Link to={n.link} onClick={() => markRead.mutate({ id: n.id })}>
                      <Button size="sm" variant="outline">Abrir</Button>
                    </Link>
                  )}
                  {!n.read_at && (
                    <Button size="sm" variant="ghost" onClick={() => markRead.mutate({ id: n.id })}>Lida</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="space-y-4 p-5">
        <h2 className="font-serif text-lg">Como quero ser avisado</h2>
        {[
          { key: "internal", label: "Notificações internas no sistema", available: true },
          { key: "email", label: "E-mail", available: false },
          { key: "push", label: "Push no celular", available: false },
          { key: "whatsapp", label: "WhatsApp", available: false },
        ].map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <Label htmlFor={`pref-${row.key}`} className="font-normal">
              {row.label}
              {!row.available && <span className="ml-2 text-xs text-muted-foreground">(em breve)</span>}
            </Label>
            <Switch
              id={`pref-${row.key}`}
              checked={!!prefs?.[row.key as keyof typeof prefs]}
              disabled={!row.available}
              onCheckedChange={(v) => savePrefs.mutate({ [row.key]: v })}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
