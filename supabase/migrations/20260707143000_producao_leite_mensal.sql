create or replace view public.producao_leite_mensal as
with mensal as (
  select
    unidade_negocio_id,
    date_trunc('month', data)::date as mes,
    sum(litros_comercial) as litros_comercial,
    sum(litros_descarte) as litros_descarte,
    sum(litros_consumo) as litros_consumo,
    sum(litros_comercial + litros_descarte + litros_consumo) as producao_total,
    count(distinct data) as dias_com_lancamento
  from public.producao_leite
  group by unidade_negocio_id, date_trunc('month', data)
)
select
  m.unidade_negocio_id,
  m.mes,
  m.litros_comercial,
  m.litros_descarte,
  m.litros_consumo,
  m.producao_total,
  m.producao_total / m.dias_com_lancamento as media_diaria,
  rc.quantidade as vacas_lactacao,
  case when rc.quantidade > 0
    then (m.producao_total / m.dias_com_lancamento) / rc.quantidade
    else null end as media_por_vaca_lactacao_dia
from mensal m
cross join lateral (
  select quantidade
  from public.rebanho_composicao(m.unidade_negocio_id, (m.mes + interval '1 month' - interval '1 day')::date)
  where categoria = 'vaca_lactacao'
) rc;
