import type { Allergen, DietRestriction, Interest, Preferences, Protein } from './types.ts'

/** Rótulos exibidos na interface para cada opção de preferência. */

export const RESTRICTION_OPTIONS: ReadonlyArray<{ value: DietRestriction; label: string; hint: string }> = [
  { value: 'sem-lactose', label: 'Sem lactose', hint: 'Oculta pratos cadastrados com lactose' },
  { value: 'sem-gluten', label: 'Sem glúten', hint: 'Oculta pratos cadastrados com glúten' },
  { value: 'vegetariano', label: 'Vegetariano', hint: 'Mostra apenas pratos sem carnes' },
  { value: 'vegano', label: 'Vegano', hint: 'Mostra apenas pratos sem ingredientes de origem animal' },
  { value: 'sem-frutos-do-mar', label: 'Sem frutos do mar', hint: 'Oculta pratos com frutos do mar' },
]

export const PROTEIN_OPTIONS: ReadonlyArray<{ value: Protein; label: string }> = [
  { value: 'frango', label: 'Frango' },
  { value: 'carne-bovina', label: 'Carne bovina' },
  { value: 'carne-suina', label: 'Carne suína' },
  { value: 'peixe', label: 'Peixe' },
  { value: 'ovo', label: 'Ovo' },
  { value: 'vegetal', label: 'Proteína vegetal' },
]

export const INTEREST_OPTIONS: ReadonlyArray<{ value: Interest; label: string; hint: string }> = [
  { value: 'leve', label: 'Refeição leve', hint: 'Pratos marcados como leves' },
  { value: 'proteico', label: 'Mais proteína', hint: 'Pratos marcados como proteicos' },
  { value: 'low-carb', label: 'Low carb', hint: 'Pratos marcados como low carb' },
  { value: 'caseiro', label: 'Sabor caseiro', hint: 'Receitas tradicionais' },
  { value: 'apimentado', label: 'Apimentado', hint: 'Pratos com tempero picante' },
  { value: 'economico', label: 'Econômico', hint: 'Pratos de menor preço no cardápio' },
]

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  lactose: 'Lactose',
  gluten: 'Glúten',
  ovo: 'Ovo',
  'frutos-do-mar': 'Frutos do mar',
  amendoim: 'Amendoim',
  soja: 'Soja',
}

export const PROTEIN_LABELS: Record<Protein, string> = Object.fromEntries(
  PROTEIN_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Protein, string>

export const INTEREST_LABELS: Record<Interest, string> = Object.fromEntries(
  INTEREST_OPTIONS.map((o) => [o.value, o.label]),
) as Record<Interest, string>

export const RESTRICTION_LABELS: Record<DietRestriction, string> = Object.fromEntries(
  RESTRICTION_OPTIONS.map((o) => [o.value, o.label]),
) as Record<DietRestriction, string>

export const ALL_ALLERGENS = Object.keys(ALLERGEN_LABELS) as Allergen[]
export const ALL_PROTEINS = PROTEIN_OPTIONS.map((o) => o.value)
export const ALL_INTERESTS = INTEREST_OPTIONS.map((o) => o.value)
export const ALL_RESTRICTIONS = RESTRICTION_OPTIONS.map((o) => o.value)

export const EMPTY_PREFERENCES: Preferences = {
  restrictions: [],
  proteins: [],
  interests: [],
  avoidIngredients: [],
  maxPrice: null,
}

export function hasAnyPreference(p: Preferences): boolean {
  return (
    p.restrictions.length > 0 ||
    p.proteins.length > 0 ||
    p.interests.length > 0 ||
    p.avoidIngredients.length > 0 ||
    p.maxPrice !== null
  )
}
