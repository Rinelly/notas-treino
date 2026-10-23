export function chaveData(d: Date) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export function hojeChave() {
  return chaveData(new Date());
}

export function dataDaChave(k: string) {
  const [a, m, d] = k.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function fmtHM(segundos: number) {
  const s = Math.max(0, Math.round(segundos));
  let h = Math.floor(s / 3600);
  let m = Math.round((s % 3600) / 60);
  if (m === 60) {
    h++;
    m = 0;
  }
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function fmtRelogio(ms: number) {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const DIAS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];
const DIAS_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function dataLonga(d: Date) {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function dataCurta(d: Date) {
  return `${DIAS_CURTO[d.getDay()]} ${d.getDate()}`;
}

/**
 * Quantos dias de calendário separam duas chaves AAAA-MM-DD.
 *
 * Conta por data, não por 24h: de ontem 23h para hoje 1h é 1 dia.
 * Por isso compara meio-dia — assim o horário de verão, que tira
 * ou põe uma hora na madrugada, não vira um dia a mais ou a menos.
 */
export function diasEntre(de: string, ate: string) {
  const a = dataDaChave(de);
  const b = dataDaChave(ate);
  a.setHours(12, 0, 0, 0);
  b.setHours(12, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "hoje", "ontem", "há 3 dias", "há 2 semanas" — null quando nunca houve */
export function haQuantoTempo(chave: string | null, hoje = hojeChave()) {
  if (!chave) return null;
  const d = diasEntre(chave, hoje);
  if (d <= 0) return "hoje";
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  if (d < 14) return "há 1 semana";
  if (d < 30) return `há ${Math.floor(d / 7)} semanas`;
  if (d < 60) return "há 1 mês";
  return `há ${Math.floor(d / 30)} meses`;
}

export function ultimosDias(n: number) {
  const agora = new Date();
  const saida: { chave: string; data: Date }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate() - i,
    );
    saida.push({ chave: chaveData(d), data: d });
  }
  return saida;
}
