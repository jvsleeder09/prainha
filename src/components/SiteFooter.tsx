import { Link } from 'react-router'
import { useCatalog } from '../state/hooks.ts'

export function SiteFooter() {
  const { business } = useCatalog()
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <section aria-labelledby="footer-brand">
            <h2 id="footer-brand">{business.storeName}</h2>
            <p>Marmitas congeladas prontas para o dia a dia.</p>
            <p>{business.tagline}</p>
          </section>
          <nav aria-labelledby="footer-nav">
            <h2 id="footer-nav">Navegação</h2>
            <ul>
              <li>
                <Link to="/cardapio">Cardápio</Link>
              </li>
              <li>
                <Link to="/preferencias">Recomendações para você</Link>
              </li>
              <li>
                <Link to="/assistente">Assistente IA</Link>
              </li>
              <li>
                <Link to="/carrinho">Carrinho</Link>
              </li>
              <li>
                <Link to="/admin">Área administrativa</Link>
              </li>
            </ul>
          </nav>
          <section aria-labelledby="footer-contact">
            <h2 id="footer-contact">Contato</h2>
            <address>
              <ul>
                <li>
                  <a href={business.instagramUrl} target="_blank" rel="noopener noreferrer">
                    Instagram @prainhanortemarmitas
                  </a>
                </li>
                <li>{business.deliveryInfo}</li>
                {business.address ? <li>{business.address}</li> : null}
                {business.openingHours ? <li>{business.openingHours}</li> : null}
                <li>{business.whatsappNumber ? 'Pedidos pelo WhatsApp' : 'WhatsApp: a configurar'}</li>
              </ul>
            </address>
          </section>
        </div>
        <p className="footer-legal">
          Projeto acadêmico. As recomendações usam apenas os dados cadastrados de cada produto e não substituem
          orientação médica ou nutricional. Ilustrações meramente ilustrativas.
        </p>
      </div>
    </footer>
  )
}
