import { useState } from 'react'
import { Link } from 'react-router'
import { ProductArt } from '../components/ProductArt.tsx'
import { TrashIcon, WhatsappIcon } from '../components/icons.tsx'
import { DemoBadge, EmptyState, Notice, PageHead, QuantityStepper } from '../components/ui.tsx'
import { summarizeCart } from '../domain/cart.ts'
import { createId, formatPrice } from '../domain/format.ts'
import type { OrderRecord } from '../domain/types.ts'
import {
  buildOrderMessage,
  buildWhatsappUrl,
  isValidWhatsappNumber,
  type CheckoutDetails,
} from '../domain/whatsapp.ts'
import { useDocumentTitle } from '../hooks/useDocumentTitle.ts'
import { useCatalog, useShop, useToast } from '../state/hooks.ts'

export function CartPage() {
  useDocumentTitle('Carrinho')
  const { products, business, registerOrder } = useCatalog()
  const { cart, setItemQuantity, removeItem, clearCart } = useShop()
  const { notify } = useToast()
  const [details, setDetails] = useState<CheckoutDetails>({ customerName: '', fulfillment: 'entrega', address: '', notes: '' })
  const [sent, setSent] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const summary = summarizeCart(cart, products)
  const phoneOk = isValidWhatsappNumber(business.whatsappNumber)
  const message = buildOrderMessage(summary, details, business.storeName)
  const waUrl = phoneOk ? buildWhatsappUrl(business.whatsappNumber, message) : null
  const nameMissing = details.customerName.trim().length < 2

  const onSend = () => {
    const order: OrderRecord = {
      id: createId('pedido-'),
      createdAt: new Date().toISOString(),
      customerName: details.customerName.trim(),
      notes: details.notes.trim(),
      fulfillment: details.fulfillment,
      items: summary.lines.map((l) => ({
        productId: l.product.id,
        name: l.product.name,
        quantity: l.quantity,
        unitPrice: l.product.price,
      })),
      total: summary.total,
      status: 'enviado',
    }
    registerOrder(order).catch(() => notify('Pedido aberto no WhatsApp, mas não foi possível registrá-lo no servidor.', 'warning'))
    setSent(true)
  }

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      notify('Mensagem do pedido copiada.', 'success')
    } catch {
      setShowPreview(true)
      notify('Não foi possível copiar automaticamente; selecione o texto abaixo.', 'warning')
    }
  }

  if (cart.length === 0) {
    return (
      <>
        <PageHead eyebrow="Carrinho" title="Seu pedido" crumbs={[{ to: '/', label: 'Início' }, { label: 'Carrinho' }]} />
        <div className="container">
          <EmptyState
            title="Seu carrinho está vazio"
            action={
              <Link to="/cardapio" className="btn">
                Ver cardápio
              </Link>
            }
          >
            Adicione marmitas do cardápio para montar seu pedido.
          </EmptyState>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHead eyebrow="Carrinho" title="Revise seu pedido" crumbs={[{ to: '/', label: 'Início' }, { label: 'Carrinho' }]}>
        <p>Ajuste as quantidades, preencha seus dados e envie o pedido pelo WhatsApp. Não há pagamento pelo site.</p>
      </PageHead>

      <div className="container cart">
        <section className="cart__items" aria-labelledby="itens-titulo">
          <h2 id="itens-titulo" className="visually-hidden">
            Itens do carrinho
          </h2>
          {summary.unavailable.length > 0 && (
            <Notice tone="warning" icon="!">
              {summary.unavailable.length} item(ns) do carrinho não estão mais disponíveis e não entram no total.{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => summary.unavailable.forEach((i) => removeItem(i.productId))}
              >
                Remover
              </button>
            </Notice>
          )}
          <ul className="cart-list" role="list">
            {summary.lines.map((line) => (
              <li key={line.product.id} className="cart-line">
                <div className="cart-line__art" aria-hidden="true">
                  <ProductArt product={line.product} />
                </div>
                <div className="cart-line__info">
                  <h3 className="cart-line__name">
                    <Link to={`/cardapio/${line.product.slug}`}>{line.product.name}</Link>
                  </h3>
                  <p className="muted">
                    {formatPrice(line.product.price)} cada {line.product.demo && <DemoBadge />}
                  </p>
                </div>
                <QuantityStepper
                  value={line.quantity}
                  onChange={(v) => setItemQuantity(line.product.id, v)}
                  label={`Quantidade de ${line.product.name}`}
                />
                <p className="cart-line__total">
                  <span className="visually-hidden">Total do item: </span>
                  {formatPrice(line.lineTotal)}
                </p>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remover ${line.product.name} do carrinho`}
                  onClick={() => {
                    removeItem(line.product.id)
                    notify(`${line.product.name} removido.`)
                  }}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (window.confirm('Esvaziar o carrinho?')) clearCart()
            }}
          >
            Esvaziar carrinho
          </button>
        </section>

        <aside className="receipt" aria-labelledby="resumo-titulo">
          <h2 id="resumo-titulo" className="receipt__title">
            Comanda
          </h2>
          <dl className="receipt__rows">
            <div>
              <dt>Itens</dt>
              <dd>{summary.itemCount}</dd>
            </div>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatPrice(summary.subtotal)}</dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>A combinar</dd>
            </div>
            <div className="receipt__total">
              <dt>Total dos produtos</dt>
              <dd>{formatPrice(summary.total)}</dd>
            </div>
          </dl>

          <form className="receipt__form" onSubmit={(e) => e.preventDefault()}>
            <div className="field">
              <label htmlFor="nome">Seu nome *</label>
              <input
                id="nome"
                className="input"
                autoComplete="name"
                required
                value={details.customerName}
                onChange={(e) => setDetails({ ...details, customerName: e.target.value })}
              />
            </div>
            <fieldset>
              <legend className="label">Recebimento</legend>
              <div className="segmented">
                {(['entrega', 'retirada'] as const).map((f) => (
                  <label key={f}>
                    <input
                      type="radio"
                      name="recebimento"
                      value={f}
                      checked={details.fulfillment === f}
                      onChange={() => setDetails({ ...details, fulfillment: f })}
                    />
                    <span>{f === 'entrega' ? 'Entrega' : 'Retirada'}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {details.fulfillment === 'entrega' && (
              <div className="field">
                <label htmlFor="endereco">Endereço de entrega</label>
                <input
                  id="endereco"
                  className="input"
                  autoComplete="street-address"
                  value={details.address}
                  onChange={(e) => setDetails({ ...details, address: e.target.value })}
                />
                <small>{business.deliveryInfo}</small>
              </div>
            )}
            <div className="field">
              <label htmlFor="obs">Observações</label>
              <textarea
                id="obs"
                className="textarea"
                rows={3}
                value={details.notes}
                onChange={(e) => setDetails({ ...details, notes: e.target.value })}
              />
            </div>

            {waUrl ? (
              <a
                href={nameMissing ? undefined : waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--whatsapp btn--block"
                aria-disabled={nameMissing}
                onClick={(e) => {
                  if (nameMissing) {
                    e.preventDefault()
                    notify('Informe seu nome para enviar o pedido.', 'warning')
                    document.getElementById('nome')?.focus()
                    return
                  }
                  onSend()
                }}
              >
                <WhatsappIcon width={20} height={20} /> Enviar pedido pelo WhatsApp
              </a>
            ) : (
              <Notice tone="warning" icon="!">
                O número de WhatsApp da loja ainda não foi configurado. Configure em <code>VITE_WHATSAPP_NUMBER</code>{' '}
                ou no painel <Link to="/admin">administrativo</Link>. Enquanto isso, você pode copiar a mensagem.
              </Notice>
            )}
            <div className="receipt__secondary">
              <button type="button" className="btn btn--ghost btn--sm" onClick={copyMessage}>
                Copiar mensagem
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowPreview((s) => !s)} aria-expanded={showPreview}>
                {showPreview ? 'Ocultar mensagem' : 'Ver mensagem'}
              </button>
            </div>
            {showPreview && (
              <pre className="receipt__preview" tabIndex={0} aria-label="Prévia da mensagem do pedido">
                {message}
              </pre>
            )}
          </form>

          {sent && (
            <div className="receipt__sent" role="status">
              <p>
                <strong>Pedido aberto no WhatsApp!</strong> Depois de enviar a mensagem, você pode esvaziar o carrinho.
              </p>
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  clearCart()
                  setSent(false)
                  notify('Carrinho esvaziado. Bom apetite!', 'success')
                }}
              >
                Esvaziar carrinho
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
