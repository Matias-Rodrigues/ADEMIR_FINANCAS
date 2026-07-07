import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export async function getUnidadeNegocioLeiteId(
  supabase: SupabaseClient<Database>,
  propriedadeId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('unidades_negocio')
    .select('id')
    .eq('propriedade_id', propriedadeId)
    .eq('tipo', 'leite')
    .maybeSingle()

  return data?.id ?? null
}
