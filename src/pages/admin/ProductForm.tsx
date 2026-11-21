import { useId, useState, type FormEvent } from 'react'
import { ProductArt } from '../../components/ProductArt.tsx'
import { parsePriceInput, slugify } from '../../domain/format.ts'
import { ALLERGEN_LABELS, ALL_ALLERGENS, INTEREST_OPTIONS, PROTEIN_OPTIONS } from '../../domain/options.ts'
import type { Category, NutritionInfo, Product } from '../../domain/types.ts'

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
}

const EMPTY_NUTRITION: NutritionInfo = { portionGrams: 0, kcal: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 }

interface Props {
  initial: Product
  categories: Category[]
  existing: Product[]
  onSave: (p: Product) => Promise<void>
  onCancel: () => void
}

export function ProductForm({ initial, categories, existing, onSave, onCancel }: Props) {
  const uid = useId()
  const [p, setP] = useState<Product>(initial)
  const [priceText, setPriceText] = useState(initial.price ? (initial.price / 100).toFixed(2).replace('.', ',') : '')
  const [ingredientsText, setIngredientsText] = useState(initial.ingredients.join(', '))
  const [hasNutrition, setHasNutrition] = useState(initial.nutrition !== null)
  const [nutrition, setNutrition] = useState<NutritionInfo>(initial.nutrition ?? EMPTY_NUTRITION)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const isNew = !existing.some((x) => x.id === initial.id)
  const id = (k: string) => `${uid}-${k}`

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    const name = p.name.trim()
    if (name.length < 3) errs.name = 'Informe um nome com pelo menos 3 caracteres.'
    const price = parsePriceInput(priceText)
    if (price === null || price <= 0) errs.price = 'Informe um preço válido (ex.: 24,90).'
    const slug = slugify(p.slug || name)
    if (!slug) errs.slug = 'Slug inválido.'
    else if (existing.some((x) => x.slug === slug && x.id !== p.id)) errs.slug = 'Já existe um produto com este endereço.'
    if (!categories.some((c) => c.id === p.categoryId)) errs.category = 'Escolha uma categoria.'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaving(true)
    try {
      await onSave({
        ...p,
        name,
        slug,
        description: p.description.trim(),
        price: price as number,
        ingredients: ingredientsText
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        vegetarian: p.vegetarian || p.vegan,
        nutrition: hasNutrition ? nutrition : null,
      })
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Falha ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <small id={id(`${k}-err`)} className="field__error">
        {errors[k]}
      </small>
    ) : null

  return (
    <form className="admin-form" onSubmit={submit} noValidate aria-labelledby={id('title')}>
      <h3 id={id('title')}>{isNew ? 'Novo produto' : `Editar: ${initial.name}`}</h3>
      {errors.form && (
        <p className="field__error" role="alert">
          {errors.form}
        </p>
      )}
      <div className="admin-form__grid">
        <div className="field">
          <label htmlFor={id('name')}>Nome *</label>
          <input
            id={id('name')}
            className="input"
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? id('name-err') : undefined}
          />
          {err('name')}
        </div>
        <div className="field">
          <label htmlFor={id('slug')}>Endereço (slug)</label>
          <input
            id={id('slug')}
            className="input"
            value={p.slug}
            placeholder={slugify(p.name) || 'gerado a partir do nome'}
            onChange={(e) => setP({ ...p, slug: e.target.value })}
            aria-invalid={!!errors.slug}
          />
          {err('slug')}
        </div>
        <div className="field">
          <label htmlFor={id('cat')}>Categoria *</label>
          <select
            id={id('cat')}
            className="select"
            value={p.categoryId}
            onChange={(e) => setP({ ...p, categoryId: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {err('category')}
        </div>
        <div className="field">
          <label htmlFor={id('price')}>Preço (R$) *</label>
          <input
            id={id('price')}
            className="input"
            inputMode="decimal"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            aria-invalid={!!errors.price}
            aria-describedby={errors.price ? id('price-err') : undefined}
          />
          {err('price')}
        </div>
        <div className="field">
          <label htmlFor={id('weight')}>Porção (g)</label>
          <input
            id={id('weight')}
            className="input"
            type="number"
            min={1}
            value={p.weightGrams ?? ''}
            onChange={(e) => setP({ ...p, weightGrams: e.target.value ? Math.max(1, Math.round(Number(e.target.value))) : null })}
          />
        </div>
        <div className="field admin-form__wide">
          <label htmlFor={id('desc')}>Descrição</label>
          <textarea id={id('desc')} className="textarea" rows={3} value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
        </div>
        <div className="field admin-form__wide">
          <label htmlFor={id('ing')}>Ingredientes</label>
          <input id={id('ing')} className="input" value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)} />
          <small>Separe por vírgulas. Usados na busca e no filtro “ingredientes a evitar”.</small>
        </div>
      </div>

      <fieldset>
        <legend>Proteínas</legend>
        <div className="chip-group">
          {PROTEIN_OPTIONS.map((o) => (
            <label key={o.value} className="chip">
              <input type="checkbox" checked={p.proteins.includes(o.value)} onChange={() => setP({ ...p, proteins: toggle(p.proteins, o.value) })} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Marcações</legend>
        <div className="chip-group">
          {INTEREST_OPTIONS.filter((o) => o.value !== 'economico').map((o) => (
            <label key={o.value} className="chip">
              <input type="checkbox" checked={p.tags.includes(o.value)} onChange={() => setP({ ...p, tags: toggle(p.tags, o.value) })} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Contém (alérgenos)</legend>
        <div className="chip-group">
          {ALL_ALLERGENS.map((a) => (
            <label key={a} className="chip">
              <input type="checkbox" checked={p.contains.includes(a)} onChange={() => setP({ ...p, contains: toggle(p.contains, a) })} />
              <span>{ALLERGEN_LABELS[a]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="admin-form__checks">
        <label className="checkbox">
          <input type="checkbox" checked={p.vegetarian} onChange={(e) => setP({ ...p, vegetarian: e.target.checked })} /> Vegetariano
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={p.vegan} onChange={(e) => setP({ ...p, vegan: e.target.checked })} /> Vegano
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={p.available} onChange={(e) => setP({ ...p, available: e.target.checked })} /> Disponível
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={p.featured} onChange={(e) => setP({ ...p, featured: e.target.checked })} /> Destaque
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={p.demo} onChange={(e) => setP({ ...p, demo: e.target.checked })} /> Produto demonstrativo
        </label>
      </div>

      <fieldset>
        <legend>
          <label className="checkbox">
            <input type="checkbox" checked={hasNutrition} onChange={(e) => setHasNutrition(e.target.checked)} /> Informação
            nutricional
          </label>
        </legend>
        {hasNutrition && (
          <div className="admin-form__grid admin-form__grid--5">
            {(
              [
                ['portionGrams', 'Porção (g)'],
                ['kcal', 'Energia (kcal)'],
                ['proteinGrams', 'Proteínas (g)'],
                ['carbGrams', 'Carboidratos (g)'],
                ['fatGrams', 'Gorduras (g)'],
              ] as const
            ).map(([k, label]) => (
              <div className="field" key={k}>
                <label htmlFor={id(k)}>{label}</label>
                <input
                  id={id(k)}
                  className="input"
                  type="number"
                  min={0}
                  step="0.1"
                  value={nutrition[k]}
                  onChange={(e) => setNutrition({ ...nutrition, [k]: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Cores da ilustração</legend>
        <div className="admin-form__art">
          {(
            [
              ['main', 'Prato principal'],
              ['side', 'Acompanhamento'],
              ['garnish', 'Guarnição'],
            ] as const
          ).map(([k, label]) => (
            <div className="field" key={k}>
              <label htmlFor={id(`art-${k}`)}>{label}</label>
              <input
                id={id(`art-${k}`)}
                type="color"
                className="color-input"
                value={p.art[k]}
                onChange={(e) => setP({ ...p, art: { ...p.art, [k]: e.target.value } })}
              />
            </div>
          ))}
          <div className="admin-form__preview" aria-hidden="true">
            <ProductArt product={p} />
          </div>
        </div>
      </fieldset>

      <div className="admin-form__actions">
        <button type="submit" className="btn" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar produto'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
