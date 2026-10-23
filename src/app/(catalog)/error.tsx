'use client'
import { Button } from '@/components/ui/button'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="error-page"><h1>El catálogo no está disponible en este momento</h1><p>Intenta cargarlo nuevamente o contacta a tu ejecutivo comercial.</p><Button onClick={reset}>Volver a intentar</Button></main>
}
