import type { Cents } from './types.ts'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Formata centavos como moeda brasileira (ex.: 2490 -> "R$ 24,90"). */
export function formatPrice(value: Cents): string {
  return brl.format(value / 100)
}

/** Converte texto digitado ("24,90", "24.9", "R$ 24,90") em centavos. Retorna null se inválido. */
export function parsePriceInput(input: string): Cents | null {
  const cleaned = input.replace(/[^\d,.-]/g, '').trim()
  if (cleaned === '') return null
  // Aceita vírgula ou ponto como separador decimal; remove separadores de milhar.
  const lastSep = Math.max(cleaned.lastIndexOf(','), cleaned.lastIndexOf('.'))
  let normalized: string
  if (lastSep === -1) {
    normalized = cleaned
  } else {
    const intPart = cleaned.slice(0, lastSep).replace(/[.,]/g, '')
    const decPart = cleaned.slice(lastSep + 1)
    normalized = `${intPart}.${decPart}`
  }
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}

/** Normaliza texto para comparação: minúsculas, sem acentos, espaços simples. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugify(text: string): string {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : dateTime.format(d)
}

/** Gera um id curto e razoavelmente único (não criptográfico). */
export function createId(prefix = ''): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${random}`
}
