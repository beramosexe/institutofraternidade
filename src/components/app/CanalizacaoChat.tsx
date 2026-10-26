import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Loader2, Send, Sparkles, UserRound } from "lucide-react";
import { toast } from "sonner";
import { askCanalizacaoAssistant } from "@/lib/canalizacao-chat.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Explique os principais temas desta canalização.",
  "Crie um texto para compartilhar esta mensagem.",
  "Quais reflexões práticas posso tirar deste conteúdo?",
];

export function CanalizacaoChat({ audioId, title }: { audioId: string; title: string }) {
  const askFn = useServerFn(askCanalizacaoAssistant);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");

  const mutation = useMutation({
    mutationFn: async (question: string) => askFn({
      data: {
        audio_id: audioId,
        question,
        history: messages.slice(-10).map(({ role, content }) => ({ role, content })),
      },
    }),
    onSuccess: (result, question) => {
      setMessages((current) => [
        ...current,
        { role: "user", content: question },
        { role: "assistant", content: result.answer },
      ]);
      setDraft("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível consultar a IA."),
  });

  function send(question = draft) {
    const value = question.trim();
    if (!value || mutation.isPending) return;
    mutation.mutate(value);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b p-5">
        <div className="rounded-full bg-brand/10 p-2 text-brand"><Bot className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-foreground">Converse sobre esta canalização</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O Gemini usa a transcrição de “{title}” como contexto para responder dúvidas e ajudar a criar conteúdos relacionados.
          </p>
        </div>
        <Sparkles className="h-4 w-4 shrink-0 text-brand" />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Por onde você quer começar?</p>
            {suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => send(suggestion)}
                disabled={mutation.isPending}
                className="block w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50">
                {suggestion}
              </button>
            ))}
          </div>
        ) : (
          <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1" aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && <Bot className="mt-1 h-4 w-4 shrink-0 text-brand" />}
                <div className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3.5 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-brand text-brand-foreground" : "bg-muted text-foreground"}`}>
                  {message.content}
                </div>
                {message.role === "user" && <UserRound className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
            ))}
            {mutation.isPending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Pensando…</div>}
          </div>
        )}

        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); send(); }}>
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)}
            placeholder="Pergunte sobre a mensagem ou peça ajuda para criar um conteúdo…" rows={2}
            maxLength={4000} disabled={mutation.isPending} className="min-h-11 resize-y" />
          <Button type="submit" size="icon" aria-label="Enviar pergunta" disabled={!draft.trim() || mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">As respostas são geradas por IA e podem conter imprecisões. Confira as interpretações com o conteúdo original.</p>
      </div>
    </Card>
  );
}
