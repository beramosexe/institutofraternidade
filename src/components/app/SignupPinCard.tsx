import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSignupPinStatus, setSignupPin } from "@/lib/signup.functions";

export function SignupPinCard() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getSignupPinStatus);
  const saveFn = useServerFn(setSignupPin);

  const { data: status, isLoading } = useQuery({
    queryKey: ["signup-pin-status"],
    queryFn: () => statusFn(),
    retry: false,
  });

  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");

  const save = useMutation({
    mutationFn: () => saveFn({ data: { pin } }),
    onSuccess: () => {
      toast.success("PIN de cadastro atualizado. O PIN anterior deixou de funcionar.");
      setPin("");
      setConfirm("");
      qc.invalidateQueries({ queryKey: ["signup-pin-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mismatch = confirm.length > 0 && pin !== confirm;
  const valid = pin.trim().length >= 4 && pin === confirm;

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-brand" />
          <h2 className="font-display text-xl text-foreground">PIN de cadastro de associados</h2>
        </div>
        {!isLoading && (
          <Badge variant={status?.configured ? "default" : "outline"}>
            {status?.configured ? "Configurado" : "Não configurado"}
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        O PIN é solicitado no formulário público de cadastro. Ele nunca é exibido aqui — apenas
        substituído. Compartilhe somente com as pessoas autorizadas a se cadastrar.
      </p>

      {status?.configured ? (
        <p className="text-xs text-muted-foreground">
          Última alteração:{" "}
          {status.updated_at
            ? format(new Date(status.updated_at), "d 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })
            : "—"}
        </p>
      ) : (
        !isLoading && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Enquanto nenhum PIN estiver definido, o formulário público de cadastro fica fechado e
              ninguém consegue criar conta.
            </span>
          </div>
        )
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-pin">{status?.configured ? "Novo PIN" : "Definir PIN"}</Label>
          <Input
            id="new-pin"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo de 4 caracteres"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-pin">Confirmar PIN</Label>
          <Input
            id="confirm-pin"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && <p className="text-xs text-destructive">Os valores não coincidem.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
          {status?.configured ? "Trocar PIN" : "Definir PIN"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Ao salvar, o PIN antigo deixa de funcionar imediatamente.
        </span>
      </div>
    </Card>
  );
}
