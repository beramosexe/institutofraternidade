/** Valida o PIN público configurado pela administração. */
export const checkSignupPin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) => z.object({ pin: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", "signup_pin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.value || String(row.value).trim() !== data.pin.trim()) {
      throw new Error("PIN de cadastro inválido.");
    }
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Cria a conta do associado pelo formulário público. A conta nasce pendente e sem cargos. */
export const signUpAssociate = createServerFn({ method: "POST" })
  .inputValidator((d: {
    full_name: string; email: string; phone?: string; password: string;
  }) =>
    z.object({
      full_name: z.string().min(3).max(120),
      email: z.string().email().max(160),
      phone: z.string().max(40).optional(),
      password: z.string().min(8).max(72),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone ?? null,
        signup_source: "associate_signup",
      },
    });
    if (error) {
      if (/already/i.test(error.message)) throw new Error("Já existe uma conta com este e-mail.");
      throw new Error(error.message);
    }

    if (created.user) {
      await supabaseAdmin.from("profiles").update({
        full_name: data.full_name,
        phone: data.phone ?? null,
        membership_status: "pending",
        validated_at: null,
        validated_by: null,
      }).eq("id", created.user.id);

      // Segurança de compatibilidade: o trigger de usuários pode ter atribuído
      // um cargo padrão antes desta versão do fluxo.
      await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);

      await supabaseAdmin.from("member_events").insert({
        user_id: created.user.id,
        kind: "member.signup",
        title: "Cadastro solicitado pelo formulário público",
      });
      await supabaseAdmin.from("audit_logs").insert({
        entity: "members",
        entity_id: created.user.id,
        action: "signup",
      });
    }

    return { ok: true };
  });

/** Administração: define/atualiza o PIN de cadastro. */
export const setSignupPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pin: string }) => z.object({ pin: z.string().min(4).max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: admin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!admin) throw new Error("Somente a administração pode alterar o PIN de cadastro.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encodePin, SIGNUP_PIN_KEY } = await import("@/lib/signup.server");
    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert(
        { key: SIGNUP_PIN_KEY, value: encodePin(data.pin), updated_by: context.userId, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId, entity: "system_settings", action: "set_signup_pin",
    });
    return { ok: true };
  });

/** Administração: informa apenas se o PIN está configurado e quando mudou. */
export const getSignupPinStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!admin) throw new Error("Somente a administração pode consultar o PIN.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SIGNUP_PIN_KEY } = await import("@/lib/signup.server");
    const { data: row } = await supabaseAdmin
      .from("system_settings")
      .select("updated_at")
      .eq("key", SIGNUP_PIN_KEY)
      .maybeSingle();
    return { configured: !!row, updated_at: row?.updated_at ?? null };
  });
