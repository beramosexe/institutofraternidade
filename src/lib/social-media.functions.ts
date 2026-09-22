import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nextWorkOccurrence, offsetMilliseconds, recurringDates, renderWorkCommunication } from "@/lib/communication-scheduling";

const channelSchema = z.enum(["instagram", "facebook", "whatsapp", "email", "telegram", "youtube"]);
const channelsSchema = z.array(channelSchema).min(1).max(6);
const statusSchema = z.enum(["draft", "pending_approval", "scheduled", "published", "failed", "cancelled"]);
const scheduleSchema = z.enum(["one_off", "recurring", "automatic"]);

const postSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  content_text: z.string().trim().min(1).max(5000),
  media_url: z.string().url().nullable().optional(),
  channels: channelsSchema,
  scheduled_for: z.string().datetime().nullable().optional(),
  status: statusSchema,
  schedule_type: scheduleSchema.default("one_off"),
  recurrence_weekday: z.number().int().min(0).max(6).nullable().optional(),
  recurrence_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  recurrence_ends_on: z.string().date().nullable().optional(),
});

const ruleSchema = z.object({
  id: z.string().uuid().optional(),
  work_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  offset_value: z.number().int().min(1).max(525600),
  offset_unit: z.enum(["minutes", "hours", "days", "weeks"]),
  channels: channelsSchema,
  content_text: z.string().trim().min(1).max(5000),
  media_url: z.string().url().nullable().optional(),
  approval_mode: z.enum(["manual", "automatic"]),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(100).default(0),
});

async function assertMediaPermission(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
) {
  const [{ data: admin }, { data: allowed }] = await Promise.all([
    supabase.rpc("is_admin", { _user_id: userId }),
    supabase.rpc("has_permission", { _user_id: userId, _permission: "media.manage" }),
  ]);
  if (!admin && !allowed) throw new Error("Você não tem permissão para gerenciar comunicações.");
}

async function assertWorkOrMediaPermission(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
) {
  const [{ data: admin }, { data: media }, { data: work }] = await Promise.all([
    supabase.rpc("is_admin", { _user_id: userId }),
    supabase.rpc("has_permission", { _user_id: userId, _permission: "media.manage" }),
    supabase.rpc("has_permission", { _user_id: userId, _permission: "work.manage" }),
  ]);
  if (!admin && !media && !work) throw new Error("Você não tem permissão para configurar avisos.");
}

export const listSocialCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const [postsResult, worksResult, rulesResult, destinationsResult, templatesResult] = await Promise.all([
      context.supabase.from("social_media_posts").select("*, social_post_deliveries(*)").order("created_at", { ascending: false }),
      context.supabase.from("works").select("id, name, starts_at, recurrence, recurrence_weekday, recurrence_time, location, status").order("starts_at"),
      context.supabase.from("work_communication_rules").select("*").order("sort_order"),
      context.supabase.from("communication_destinations").select("*").eq("is_active", true).order("name"),
      context.supabase.from("communication_templates").select("*").eq("is_active", true).order("name"),
    ]);
    if (postsResult.error) throw new Error(postsResult.error.message);
    if (rulesResult.error) throw new Error(rulesResult.error.message);
    return {
      posts: postsResult.data ?? [],
      works: worksResult.data ?? [],
      rules: rulesResult.data ?? [],
      destinations: destinationsResult.data ?? [],
      templates: templatesResult.data ?? [],
    };
  });

export const saveSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof postSchema>) => postSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    if (data.channels.includes("instagram") && !data.media_url) throw new Error("Escolha uma imagem para publicar no Instagram.");
    if (data.schedule_type === "recurring" && (data.recurrence_weekday == null || !data.recurrence_time)) {
      throw new Error("Escolha o dia da semana e o horário da recorrência.");
    }
    const { id, ...values } = data;
    const row = {
      ...values,
      media_url: values.media_url || null,
      scheduled_for: values.scheduled_for || null,
      recurrence_time: values.recurrence_time || null,
      recurrence_ends_on: values.recurrence_ends_on || null,
      communication_kind: "publication",
      source: "manual",
      approved_at: values.status === "scheduled" ? new Date().toISOString() : null,
      approved_by: values.status === "scheduled" ? context.userId : null,
    };
    if (id) {
      const { error } = await context.supabase.from("social_media_posts").update(row).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const seriesId = values.schedule_type === "recurring" ? crypto.randomUUID() : null;
    if (values.schedule_type === "recurring") {
      const start = values.scheduled_for ? new Date(values.scheduled_for) : new Date();
      const dates = recurringDates(values.recurrence_weekday ?? 0, values.recurrence_time ?? "19:00", start, values.recurrence_ends_on ?? null);
      const inserts = dates.map((date) => ({ ...row, scheduled_for: date.toISOString(), recurrence_series_id: seriesId, created_by: context.userId }));
      const { data: created, error } = await context.supabase.from("social_media_posts").insert(inserts).select("id");
      if (error) throw new Error(error.message);
      return { id: created?.[0]?.id ?? seriesId, created: created?.length ?? 0 };
    }
    const { data: created, error } = await context.supabase
      .from("social_media_posts")
      .insert({ ...row, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const updateSocialPostStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: z.infer<typeof statusSchema> }) => z.object({ id: z.string().uuid(), status: statusSchema }).parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const approval = data.status === "scheduled"
      ? { approved_at: new Date().toISOString(), approved_by: context.userId, last_error: null }
      : {};
    const { error } = await context.supabase.from("social_media_posts").update({ status: data.status, ...approval }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const { error } = await context.supabase.from("social_media_posts").delete().eq("id", data.id).neq("status", "published");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveWorkCommunicationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof ruleSchema>) => ruleSchema.parse(input))
  .handler(async ({ context, data }) => {
    await assertWorkOrMediaPermission(context.supabase, context.userId);
    const { id, ...values } = data;
    const row = { ...values, media_url: values.media_url || null, created_by: context.userId };
    const query = id
      ? context.supabase.from("work_communication_rules").update(row).eq("id", id)
      : context.supabase.from("work_communication_rules").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkCommunicationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertWorkOrMediaPermission(context.supabase, context.userId);
    const { error } = await context.supabase.from("work_communication_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWorkCommunicationRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId: string }) => z.object({ workId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertWorkOrMediaPermission(context.supabase, context.userId);
    const { data: rules, error } = await context.supabase
      .from("work_communication_rules")
      .select("*")
      .eq("work_id", data.workId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rules ?? [];
  });

export const generateWorkReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workId?: string }) => z.object({ workId: z.string().uuid().optional() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    let rulesQuery = context.supabase.from("work_communication_rules").select("*").eq("is_active", true);
    if (data.workId) rulesQuery = rulesQuery.eq("work_id", data.workId);
    const { data: rules, error } = await rulesQuery;
    if (error) throw new Error(error.message);
    let created = 0;
    for (const rule of rules ?? []) {
      const { data: work } = await context.supabase
        .from("works")
        .select("id, name, starts_at, recurrence, recurrence_weekday, recurrence_time, location, status")
        .eq("id", rule.work_id)
        .maybeSingle();
      if (!work || ["cancelled", "completed", "archived"].includes(work.status)) continue;
      const occurrence = nextWorkOccurrence(work);
      const { data: exception } = await context.supabase
        .from("work_occurrence_exceptions")
        .select("action, new_starts_at")
        .eq("work_id", work.id)
        .eq("original_starts_at", occurrence.toISOString())
        .maybeSingle();
      if (exception?.action === "cancelled") continue;
      const effectiveOccurrence = exception?.new_starts_at ? new Date(exception.new_starts_at) : occurrence;
      const { data: existing } = await context.supabase
        .from("social_media_posts")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("occurrence_at", effectiveOccurrence.toISOString())
        .neq("status", "cancelled")
        .maybeSingle();
      if (existing) continue;
      const scheduled = new Date(effectiveOccurrence.getTime() - offsetMilliseconds(rule.offset_value, rule.offset_unit as "minutes" | "hours" | "days" | "weeks"));
      const automatic = rule.approval_mode === "automatic";
      const { error: insertError } = await context.supabase.from("social_media_posts").insert({
        title: `${rule.name} · ${work.name}`,
        content_text: renderWorkCommunication(rule.content_text, work, effectiveOccurrence),
        media_url: rule.media_url,
        channels: rule.channels,
        scheduled_for: scheduled.toISOString(),
        status: automatic ? "scheduled" : "draft",
        approval_mode: rule.approval_mode,
        approved_at: automatic ? new Date().toISOString() : null,
        approved_by: automatic ? context.userId : null,
        source: "work_reminder",
        communication_kind: "work_notice",
        schedule_type: "automatic",
        work_id: work.id,
        rule_id: rule.id,
        occurrence_at: effectiveOccurrence.toISOString(),
        reminder_minutes: Math.round(offsetMilliseconds(rule.offset_value, rule.offset_unit as "minutes" | "hours" | "days" | "weeks") / 60_000),
        created_by: context.userId,
      });
      if (insertError) throw new Error(insertError.message);
      created += 1;
    }
    return { created };
  });

export const getMetaConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMediaPermission(context.supabase, context.userId);
    return {
      metaConfigured: Boolean(process.env['META_ACCESS_TOKEN'] && process.env['META_PAGE_ID'] && process.env['META_INSTAGRAM_ACCOUNT_ID']),
      whatsappConfigured: Boolean(process.env['WHATSAPP_API_KEY'] && process.env['LOVABLE_API_KEY']),
    };
  });

export const publishSocialPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertMediaPermission(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post } = await supabaseAdmin.from("social_media_posts").select("*").eq("id", data.id).single();
    if (!post) throw new Error("Comunicação não encontrada.");
    if (post.status !== "scheduled" && post.status !== "failed") throw new Error("A comunicação precisa estar aprovada.");
    const { publishCommunication } = await import("@/lib/social-media.server");
    await publishCommunication(post);
    return { ok: true };
  });