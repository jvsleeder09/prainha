import { useEffect } from 'react'

/** Atualiza o <title> da página (importante para acessibilidade e histórico do navegador). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Prainha` : 'Prainha · Marmitas congeladas'
  }, [title])
}
