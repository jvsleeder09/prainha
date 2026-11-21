import { lazy } from 'react'

// Páginas menos acessadas são carregadas sob demanda (code splitting).
export const AssistantPage = lazy(() => import('./AssistantPage.tsx').then((m) => ({ default: m.AssistantPage })))
export const AdminPage = lazy(() => import('./admin/AdminPage.tsx').then((m) => ({ default: m.AdminPage })))
