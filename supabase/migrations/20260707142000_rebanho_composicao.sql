create or replace function public.rebanho_composicao(p_unidade_negocio_id uuid, p_data date)
returns table (categoria text, quantidade bigint)
language sql
stable
as $$
  with categorias as (
    select unnest(array[
      'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
      'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
    ]) as categoria
  ),
  ultimo_ajuste as (
    select distinct on (categoria_animal)
      categoria_animal as categoria, quantidade, data
    from public.eventos_operacionais
    where unidade_negocio_id = p_unidade_negocio_id
      and tipo_evento = 'ajuste_inventario'
      and data <= p_data
    order by categoria_animal, data desc, created_at desc
  ),
  entradas as (
    select eo.categoria_animal as categoria, coalesce(sum(eo.quantidade), 0) as total
    from public.eventos_operacionais eo
    left join ultimo_ajuste ua on ua.categoria = eo.categoria_animal
    where eo.unidade_negocio_id = p_unidade_negocio_id
      and eo.tipo_evento in ('nascimento', 'compra_animal')
      and eo.data <= p_data
      and eo.data > coalesce(ua.data, '0001-01-01'::date)
    group by eo.categoria_animal
  ),
  saidas as (
    select eo.categoria_animal as categoria, coalesce(sum(eo.quantidade), 0) as total
    from public.eventos_operacionais eo
    left join ultimo_ajuste ua on ua.categoria = eo.categoria_animal
    where eo.unidade_negocio_id = p_unidade_negocio_id
      and eo.tipo_evento in ('mortalidade', 'venda_animal')
      and eo.data <= p_data
      and eo.data > coalesce(ua.data, '0001-01-01'::date)
    group by eo.categoria_animal
  ),
  mudancas_entrada as (
    select eo.categoria_animal as categoria, coalesce(sum(eo.quantidade), 0) as total
    from public.eventos_operacionais eo
    left join ultimo_ajuste ua on ua.categoria = eo.categoria_animal
    where eo.unidade_negocio_id = p_unidade_negocio_id
      and eo.tipo_evento = 'mudanca_categoria'
      and eo.data <= p_data
      and eo.data > coalesce(ua.data, '0001-01-01'::date)
    group by eo.categoria_animal
  ),
  mudancas_saida as (
    select eo.categoria_origem as categoria, coalesce(sum(eo.quantidade), 0) as total
    from public.eventos_operacionais eo
    left join ultimo_ajuste ua on ua.categoria = eo.categoria_origem
    where eo.unidade_negocio_id = p_unidade_negocio_id
      and eo.tipo_evento = 'mudanca_categoria'
      and eo.data <= p_data
      and eo.data > coalesce(ua.data, '0001-01-01'::date)
    group by eo.categoria_origem
  )
  select
    c.categoria,
    (coalesce((select ua.quantidade from ultimo_ajuste ua where ua.categoria = c.categoria), 0)
      + coalesce((select total from entradas e where e.categoria = c.categoria), 0)
      - coalesce((select total from saidas s where s.categoria = c.categoria), 0)
      + coalesce((select total from mudancas_entrada me where me.categoria = c.categoria), 0)
      - coalesce((select total from mudancas_saida ms where ms.categoria = c.categoria), 0)
    )::bigint as quantidade
  from categorias c;
$$;
