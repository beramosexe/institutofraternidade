import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LogErrorInput = {
  category: string;
  event: string;
  message: string;
  userId?: string | null;
  audioId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function persistSystemError(input: LogErrorInput) {
  const requestId = input.requestId ?? randomUUID();
  const { error } = await supabaseAdmin.from("system_error_logs").insert({
    category: input.category.slice(0, 80),
    event: input.event.slice(0, 120),
    message: input.message.slice(0, 2000),
    user_id: input.userId ?? null,
    audio_id: input.audioId ?? null,
    request_id: requestId,
    metadata: (input.metadata ?? {}) as never,
  });

  if (error) {
    console.error("[SystemErrorLog] Falha ao persistir erro", error.message, input);
  }

  return requestId;
}
