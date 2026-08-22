import { faltando } from "../lib/supabase";
import s from "./SemConfig.module.scss";

export default function SemConfig() {
  const emProducao = import.meta.env.PROD;

  return (
    <div className={s.page}>
      <div className={s.box}>
        <h1 className={s.titulo}>Faltam as chaves do Supabase</h1>
        <p className={s.texto}>
          O app carregou, mas não sabe com qual banco falar. Sem isso não dá nem
          pra fazer login.
        </p>

        <div className={s.rotulo}>Não encontrei:</div>
        <ul className={s.lista}>
          {faltando.map((v) => (
            <li key={v}>
              <code>{v}</code>
            </li>
          ))}
        </ul>

        {emProducao ? (
          <>
            <div className={s.rotulo}>Como resolver na Vercel</div>
            <ol className={s.passos}>
              <li>
                Painel do projeto → <b>Settings</b> →{" "}
                <b>Environment Variables</b>
              </li>
              <li>
                Adicione as variáveis acima, marcando Production, Preview e
                Development
              </li>
              <li>
                <b>Deployments</b> → nos três pontinhos do último →{" "}
                <b>Redeploy</b>
              </li>
            </ol>
            <p className={s.aviso}>
              O passo 3 é obrigatório: o Vite grava esses valores dentro do
              JavaScript na hora de compilar. Variável nova só vale num build
              novo.
            </p>
          </>
        ) : (
          <>
            <div className={s.rotulo}>Como resolver aqui</div>
            <ol className={s.passos}>
              <li>
                <code>cp .env.example .env.local</code>
              </li>
              <li>Preencha a URL e a publishable key do seu projeto</li>
              <li>
                Reinicie o <code>npm run dev</code>
              </li>
            </ol>
            <p className={s.aviso}>
              O Vite só lê o <code>.env</code> quando inicia — salvar o arquivo
              com o servidor rodando não adianta.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
