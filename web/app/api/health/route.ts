import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { error } = await supabase.from('propriedades').select('id').limit(1)
  return NextResponse.json({ ok: !error, error: error?.message ?? null })
}
