import type { AiCatalogItem, AiRecommendRequest } from '../../supabase/functions/_shared/ai-contract.ts'
import { AI_LIMITS } from '../../supabase/functions/_shared/ai-contract.ts'
import { PRIVACY_MESSAGES, findHealthTerm, findPersonalData } from '../../supabase/functions/_shared/ai-privacy.ts'
import { avoidedIngredient, restrictionViolation } from './recommendation.ts'
import type { Category, Preferences, Product } from './types.ts'

/**
 * Monta, no navegador, o que será enviado ao backend de IA — garantindo a regra de privacidade:
 *  - restrições alimentares, ingredientes a evitar e preço máximo são aplicados AQUI (filtram o catálogo) e
 *    não são enviados;
 *  - só vão as preferências de gosto (proteínas e estilos), o pedido e o catálogo filtrado;
 *  - pedidos que pareçam conter dados pessoais ou de saúde são bloqueados antes de qualquer envio.
 */

export type AiPayloadResult =
  | { ok: true; request: AiRecommendRequest; locallyExcluded: number }
  | { ok: false; code: 'sensitive_content' | 'invalid_request'; message: string }

export function toAiCatalog(products: Product[], categories: Category[]): AiCatalogItem[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: categories.find((c) => c.id === p.categoryId)?.name ?? p.categoryId,
    priceCents: p.price,
    proteins: p.proteins,
    tags: p.tags,
    ingredients: p.ingredients,
    contains: p.contains,
    vegetarian: p.vegetarian,
    vegan: p.vegan,
    demo: p.demo,
  }))
}

/** Verifica apenas o texto (usado também para avisar o usuário enquanto digita). */
export function checkAiMessage(message: string): { ok: true } | { ok: false; message: string } {
  if (findHealthTerm(message)) return { ok: false, message: PRIVACY_MESSAGES.health }
  const personal = findPersonalData(message)
  if (personal.length) return { ok: false, message: PRIVACY_MESSAGES.personal(personal) }
  return { ok: true }
}

/**
 * @param prefs preferências salvas a considerar, ou null para não considerar nenhuma.
 */
export function buildAiRequest(
  message: string,
  prefs: Preferences | null,
  products: Product[],
  categories: Category[],
): AiPayloadResult {
  const text = message.trim().slice(0, AI_LIMITS.maxMessageLength)
  if (text.length < 3) return { ok: false, code: 'invalid_request', message: 'Descreva o que você procura (mínimo de 3 caracteres).' }

  const privacy = checkAiMessage(text)
  if (!privacy.ok) return { ok: false, code: 'sensitive_content', message: privacy.message }

  const available = products.filter((p) => p.available)
  const allowed = prefs
    ? available.filter(
        (p) =>
          !restrictionViolation(p, prefs.restrictions) &&
          !avoidedIngredient(p, prefs.avoidIngredients) &&
          (prefs.maxPrice === null || p.price <= prefs.maxPrice),
      )
    : available

  if (allowed.length === 0) {
    return {
      ok: false,
      code: 'invalid_request',
      message: prefs
        ? 'Nenhuma marmita disponível atende às suas preferências salvas. Ajuste-as ou desmarque a opção.'
        : 'Não há marmitas disponíveis no cardápio no momento.',
    }
  }

  return {
    ok: true,
    locallyExcluded: available.length - allowed.length,
    request: {
      message: text,
      preferences: { proteins: prefs?.proteins ?? [], interests: prefs?.interests ?? [] },
      catalog: toAiCatalog(allowed.slice(0, AI_LIMITS.maxCatalogItems), categories),
    },
  }
}
