/* =========================================================
   supabase.ts — o cliente, criado uma vez só

   As chaves vêm do .env.local em desenvolvimento e das
   variáveis de ambiente do provedor (Vercel) em produção.

   Importante: este arquivo NÃO derruba o app se as chaves
   faltarem. Antes ele lançava erro na importação, e o
   resultado era uma tela preta sem explicação nenhuma.
   Agora ele avisa e o App mostra o que está faltando.
   ========================================================= */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()

/** dá pra falar com o Supabase? */
export const configOk = Boolean(url && key)

/** quais faltam — usado na tela de ajuda */
export const faltando = [
  !url && 'VITE_SUPABASE_URL',
  !key && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean) as string[]

// a URL é só o domínio do projeto: o cliente acrescenta /rest/v1 e /auth/v1
export const supabase: SupabaseClient = configOk
  ? createClient(url.replace(/\/+$/, ''), key)
  : (null as unknown as SupabaseClient)

/** id do usuário logado — todo insert precisa dele por causa do RLS */
export async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Sem sessão ativa. Faça login novamente.')
  return id
}
