/**
 * Proteção de privacidade do assistente de IA (funções puras, sem dependências de ambiente).
 *
 * Regra do projeto: nenhuma informação pessoal ou de saúde do usuário é enviada ao provedor de IA.
 *  - No navegador: o pedido é BLOQUEADO antes do envio se parecer conter dados pessoais ou de saúde, e o usuário
 *    é orientado a reformular (nada sai do aparelho).
 *  - No servidor (defesa em profundidade): dados pessoais são mascarados e termos de saúde fazem a requisição ser
 *    recusada, mesmo que um cliente modificado tente enviá-los.
 *
 * É uma detecção por padrões (heurística). Não substitui o aviso ao usuário, que continua sendo exibido.
 */

export type PersonalDataKind = 'e-mail' | 'telefone ou documento' | 'endereço' | 'nome' | 'link'

interface Pattern {
  kind: PersonalDataKind
  re: RegExp
  /** Validação extra do trecho encontrado (ex.: quantidade mínima de dígitos). */
  accept?: (match: string) => boolean
}

const digitCount = (s: string) => (s.match(/\d/g) ?? []).length

const PERSONAL_PATTERNS: Pattern[] = [
  { kind: 'e-mail', re: /[^\s@]+@[^\s@]+\.[^\s@]+/g },
  { kind: 'link', re: /\bhttps?:\/\/\S+|\bwww\.\S+/gi },
  // Telefones, CPF, CEP e outros números longos: 8 ou mais dígitos (preços como "28,90" não chegam a isso).
  { kind: 'telefone ou documento', re: /\+?\d[\d\s()./-]{6,}\d/g, accept: (m) => digitCount(m) >= 8 },
  // Endereços comuns (inclui siglas usadas no DF). Mascara o trecho até a próxima pontuação.
  {
    kind: 'endereço',
    re: /\b(?:rua|avenida|av\.|travessa|alameda|rodovia|quadra|qd\.?|cj\.?|apartamento|apto\.?|sqn|sqs|sqsw|shis|shin|cln|cls|qnm|qnn|qnl|qna|qnb|qnc|qnd|qne|qnf|qng|qnj|qnp|qnq|qnr|qr|qs|csb|csg)\s+(?:[A-Za-zÀ-ÿ]+\s+){0,4}\d[^,.;\n]*/gi,
  },
  { kind: 'nome', re: /\b(?:meu nome (?:é|e)|me chamo)\s+[A-Za-zÀ-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+){0,2}/gi },
]

/** Termos que indicam condição de saúde (comparados sem acento e em minúsculas). */
const HEALTH_TERMS =
  /\b(alergi\w*|alergic\w*|intoleran\w*|celiac\w*|diabet\w*|insulina|glicemia|hipertens\w*|pressao alta|colesterol|triglicerid\w*|gravid\w*|gestante|gestacao|amamenta\w*|lactante|doenca\w*|doente|remedio\w*|medicament\w*|medicacao|tratamento|cirurgi\w*|cancer|quimio\w*|renal|cardiac\w*|cardiopat\w*|obesidade|anemi\w*|gastrite|refluxo|nutricionista|medic[oa]s?|exames?|laudo|diagnostic\w*|autis\w*|tdah|depressao|ansiedade)\b/

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Lista os tipos de dado pessoal encontrados no texto (sem repetição). */
export function findPersonalData(text: string): PersonalDataKind[] {
  const found = new Set<PersonalDataKind>()
  for (const p of PERSONAL_PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      if (!p.accept || p.accept(m[0])) found.add(p.kind)
    }
  }
  return [...found]
}

/** Substitui dados pessoais por "[removido]". Retorna o texto limpo e os tipos removidos. */
export function redactPersonalData(text: string): { text: string; removed: PersonalDataKind[] } {
  const removed = new Set<PersonalDataKind>()
  let out = text
  for (const p of PERSONAL_PATTERNS) {
    out = out.replace(p.re, (m) => {
      if (p.accept && !p.accept(m)) return m
      removed.add(p.kind)
      return '[removido]'
    })
  }
  return { text: out, removed: [...removed] }
}

/** Retorna o primeiro termo de saúde encontrado (forma sem acento), ou null. */
export function findHealthTerm(text: string): string | null {
  const m = fold(text).match(HEALTH_TERMS)
  return m ? m[1] : null
}

export const PRIVACY_MESSAGES = {
  health:
    'Para proteger sua privacidade, não envie informações de saúde ao assistente. Para restrições alimentares, use a página Preferências: elas são aplicadas aqui no seu aparelho e não são enviadas à IA.',
  personal: (kinds: PersonalDataKind[]) =>
    `Remova do texto os dados pessoais (${kinds.join(', ')}). O assistente só precisa saber o que você quer comer.`,
} as const
