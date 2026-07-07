alter table public.eventos_operacionais
  drop constraint eventos_operacionais_tipo_evento_check,
  add constraint eventos_operacionais_tipo_evento_check
    check (tipo_evento in (
      'producao', 'mortalidade', 'insumo', 'venda', 'ocorrencia_sanitaria',
      'nascimento', 'mudanca_categoria', 'compra_animal', 'venda_animal', 'ajuste_inventario'
    ));

alter table public.eventos_operacionais
  add column categoria_animal text check (categoria_animal in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  )),
  add column categoria_origem text check (categoria_origem in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  ));
