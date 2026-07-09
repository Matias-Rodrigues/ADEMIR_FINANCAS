import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export async function animalPertenceAPropriedade(
  supabase: SupabaseClient<Database>,
  animalId: string,
  propriedadeId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('animais')
    .select('id')
    .eq('id', animalId)
    .eq('propriedade_id', propriedadeId)
    .maybeSingle()

  return data !== null
}
