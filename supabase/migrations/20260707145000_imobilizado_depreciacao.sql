alter table public.imobilizados
  add column categoria text not null default 'maquina' constraint imobilizados_categoria_check check (categoria in ('benfeitoria', 'maquina')),
  add column valor_residual numeric(12,2) not null default 0 constraint imobilizados_valor_residual_check check (valor_residual >= 0 and valor_residual < valor_aquisicao),
  add column ativo boolean not null default true;

alter table public.imobilizados alter column categoria drop default;
alter table public.imobilizados alter column valor_residual drop default;

create policy "editar imobilizados"
  on public.imobilizados for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'lancar'));

create or replace view public.imobilizados_depreciacao
  with (security_invoker = true) as
select
  id, propriedade_id, unidade_negocio_id, categoria, nome, valor_aquisicao, valor_residual,
  data_aquisicao, vida_util_anos, ativo,
  (valor_aquisicao - valor_residual) / vida_util_anos as depreciacao_anual,
  (valor_aquisicao - valor_residual) / vida_util_anos / 12 as depreciacao_mensal
from public.imobilizados;
