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
