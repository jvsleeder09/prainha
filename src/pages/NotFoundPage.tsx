import { Link } from 'react-router'
import { EmptyState } from '../components/ui.tsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada')
  return (
    <div className="container section">
      <EmptyState
        title="Essa página foi para a praia"
        action={
          <Link to="/" className="btn">
            Voltar ao início
          </Link>
        }
      >
        Não encontramos o endereço que você procurou. Que tal dar uma olhada no cardápio?
      </EmptyState>
    </div>
  )
}
