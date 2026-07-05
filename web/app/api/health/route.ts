import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Instancia o client server para validar o wiring de cookies/env usado pelas Tasks 4-7.
    await createClient()

    // supabase.auth.getUser() so faz round-trip de rede quando ha uma sessao/cookie com
    // access_token; sem sessao (caso comum de uma requisicao anonima como esta), o SDK
    // retorna AuthSessionMissingError localmente sem tocar a rede - nao serve como teste
    // de conectividade. Por isso batemos direto no endpoint de health do GoTrue, que
    // sempre faz uma chamada HTTP real e nao depende de nenhuma tabela protegida por RLS.
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Supabase Auth respondeu ${res.status}` })
    }
    return NextResponse.json({ ok: true, error: null })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
