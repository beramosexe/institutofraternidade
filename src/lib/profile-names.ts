type DisplayRpcClient = {
  rpc: (
    fn: "get_profile_display",
    args: { _user_id: string },
  ) => PromiseLike<{ data: unknown }>;
};

/** Resolve nomes de exibição (profiles são restritos; usa RPC segura). */
export async function resolveDisplayNames(
  supabase: DisplayRpcClient,
  ids: Array<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  const names: Record<string, string> = {};
  await Promise.all(
    unique.map(async (uid) => {
      const { data } = await supabase.rpc("get_profile_display", { _user_id: uid });
      const row = Array.isArray(data) ? (data[0] as { full_name?: string }) : (data as { full_name?: string } | null);
      if (row?.full_name) names[uid] = row.full_name;
    }),
  );
  return names;
}
