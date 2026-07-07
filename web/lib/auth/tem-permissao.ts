import { createClient } from '@/lib/supabase/server'

export async function temPermissao(modulo: string, acao: 'ver' | 'lancar'): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('tem_permissao', { p_modulo: modulo, p_acao: acao })
  return data === true
}
