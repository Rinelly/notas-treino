/* =========================================================
   supabase.ts — o cliente, criado uma vez só

   As chaves vêm do .env.local, que fica fora do Git.
   Copie o .env.example e preencha (veja o README).
   ========================================================= */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Faltam as variáveis do Supabase. Copie o .env.example para .env.local ' +
      'e preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY. ' +
      'Depois reinicie o servidor do Vite — ele só lê o .env na inicialização.',
  )
}

// a URL é só o domínio do projeto: o cliente acrescenta /rest/v1 e /auth/v1
export const supabase = createClient(url.replace(/\/+$/, ''), key)

/** id do usuário logado — todo insert precisa dele por causa do RLS */
export async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Sem sessão ativa. Faça login novamente.')
  return id
}
