import type { BusinessInfo } from '../domain/types.ts'

/**
 * Informações comerciais padrão.
 *
 * Fonte das informações reais: perfil público do Instagram @prainhanortemarmitas
 * (consultado em 20/11/2026): nome "Prainha | Marmitas congeladas",
 * bio "Marmitas congeladas prontas para o dia a dia" e "Sabor caseiro • praticidade • qualidade",
 * e menção a "Delivery para todo DF…" (texto truncado na página pública).
 *
 * Telefone, endereço e horário NÃO estão disponíveis publicamente e ficam vazios até
 * serem configurados:
 *  - WhatsApp: variável VITE_WHATSAPP_NUMBER (.env) ou painel /admin > Informações comerciais.
 *  - Demais campos: painel /admin.
 */
export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  storeName: 'Prainha',
  tagline: 'Sabor caseiro • praticidade • qualidade',
  whatsappNumber: (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').replace(/\D/g, ''),
  deliveryInfo: 'Delivery no DF — confirme a sua região pelo WhatsApp.',
  openingHours: '',
  address: '',
  instagramUrl: 'https://www.instagram.com/prainhanortemarmitas/',
}
