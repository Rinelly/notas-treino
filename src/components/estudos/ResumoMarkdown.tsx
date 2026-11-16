import s from '../../pages/Estudos.module.scss'

/** **negrito** e *itálico*, que é o que o tutor usa dentro das frases */
function negrito(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((parte, i) => {
    if (parte.length > 4 && parte.startsWith('**') && parte.endsWith('**')) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>
    }
    if (parte.length > 2 && parte.startsWith('*') && parte.endsWith('*')) {
      return <em key={i}>{parte.slice(1, -1)}</em>
    }
    return parte
  })
}

/** O Markdown simples que o tutor usa no resumo: títulos, listas, negrito e itálico. */
export default function ResumoMarkdown({ texto }: { texto: string }) {
  return (
    <div className={s.markdown}>
      {texto.split('\n').map((linha, i) => {
        const t = linha.trim()
        if (!t) return null
        if (t.startsWith('#')) return <h4 key={i}>{negrito(t.replace(/^#+\s*/, ''))}</h4>
        if (/^[-*]\s/.test(t)) {
          return (
            <p key={i} className={s.item}>
              {negrito(t.slice(2))}
            </p>
          )
        }
        return <p key={i}>{negrito(t)}</p>
      })}
    </div>
  )
}
