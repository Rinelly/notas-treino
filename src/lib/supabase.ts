import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

export const configOk = Boolean(url && key);

export const faltando = [
  !url && "VITE_SUPABASE_URL",
  !key && "VITE_SUPABASE_PUBLISHABLE_KEY",
].filter(Boolean) as string[];

export const supabase: SupabaseClient = configOk
  ? createClient(url.replace(/\/+$/, ""), key)
  : (null as unknown as SupabaseClient);

export async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error("Sem sessão ativa. Faça login novamente.");
  return id;
}
