/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Número de WhatsApp da loja, com DDI e DDD, apenas dígitos (ex.: 5561999999999). */
  readonly VITE_WHATSAPP_NUMBER?: string
  /** Endpoint do backend de IA. Padrão: /api/ai (servidor local via proxy do Vite). */
  readonly VITE_AI_ENDPOINT?: string
  /** URL do projeto Supabase (ex.: https://xxxx.supabase.co). */
  readonly VITE_SUPABASE_URL?: string
  /** Chave pública "anon" do Supabase. É pública por natureza; a segurança vem das políticas RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
