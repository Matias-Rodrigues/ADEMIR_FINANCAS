export const CATEGORIAS_POR_TIPO = {
  receita: [
    { valor: 'venda_leite', rotulo: 'Venda de leite' },
    { valor: 'venda_suino', rotulo: 'Venda de suínos' },
    { valor: 'outras_receitas', rotulo: 'Outras receitas' },
  ],
  despesa: [
    { valor: 'racao', rotulo: 'Ração' },
    { valor: 'insumo', rotulo: 'Insumo' },
    { valor: 'veterinario', rotulo: 'Veterinário' },
    { valor: 'combustivel', rotulo: 'Combustível' },
    { valor: 'energia', rotulo: 'Energia' },
    { valor: 'manutencao', rotulo: 'Manutenção' },
    { valor: 'mao_de_obra', rotulo: 'Mão de obra' },
    { valor: 'outras_despesas', rotulo: 'Outras despesas' },
  ],
} as const

export function categoriaValida(tipo: string, categoria: string): boolean {
  if (tipo !== 'receita' && tipo !== 'despesa') {
    return false
  }
  return CATEGORIAS_POR_TIPO[tipo].some((item) => item.valor === categoria)
}

export function rotuloCategoria(categoria: string): string {
  const todas = [...CATEGORIAS_POR_TIPO.receita, ...CATEGORIAS_POR_TIPO.despesa]
  return todas.find((item) => item.valor === categoria)?.rotulo ?? categoria
}
