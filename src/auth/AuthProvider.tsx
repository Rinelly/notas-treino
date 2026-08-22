import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthCtx {
  user: User | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  criarConta: (
    email: string,
    senha: string,
  ) => Promise<{ precisaConfirmar: boolean }>;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });

    // mantém a sessão em dia se ela expirar ou se sair em outra aba
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const valor: AuthCtx = {
    user: session?.user ?? null,
    carregando,

    async entrar(email, senha) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) throw error;
    },

    async criarConta(email, senha) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
      });
      if (error) throw error;
      // sem sessão de volta = confirmação de e-mail está ligada no projeto
      return { precisaConfirmar: !data.session };
    },

    async sair() {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

/** mensagens do Supabase traduzidas pra algo legível */
export function traduzirErro(err: unknown): string {
  const m = (
    err instanceof Error ? err.message : String(err ?? "")
  ).toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered"))
    return "Esse e-mail já tem conta. Tente entrar.";
  if (m.includes("email not confirmed"))
    return "Confirme o e-mail que enviamos antes de entrar.";
  if (m.includes("password") && m.includes("6"))
    return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Sem conexão com o Supabase. Confira a URL no .env.local.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minuto.";
  return err instanceof Error
    ? err.message
    : "Não consegui completar. Tente de novo.";
}
