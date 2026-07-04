create table public.lancamentos_custo_compartilhado (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  data date not null,
  descricao text not null,
  valor_total numeric(12,2) not null check (valor_total > 0),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.lancamentos_custo_compartilhado enable row level security;

create table public.rateio_custo_compartilhado_itens (
  id uuid primary key default gen_random_uuid(),
  lancamento_custo_compartilhado_id uuid not null references public.lancamentos_custo_compartilhado(id) on delete cascade,
  destino_tipo text not null check (destino_tipo in ('unidade_negocio', 'familiar_consolidado')),
  unidade_negocio_id uuid references public.unidades_negocio(id) on delete restrict,
  valor numeric(12,2) not null check (valor > 0),
  created_at timestamptz not null default now(),
  constraint rateio_destino_consistente_check check (
    (destino_tipo = 'unidade_negocio' and unidade_negocio_id is not null)
    or
    (destino_tipo = 'familiar_consolidado' and unidade_negocio_id is null)
  )
);

alter table public.rateio_custo_compartilhado_itens enable row level security;

create index rateio_itens_lancamento_id_idx on public.rateio_custo_compartilhado_itens(lancamento_custo_compartilhado_id);

create index lancamentos_custo_compartilhado_propriedade_id_idx on public.lancamentos_custo_compartilhado(propriedade_id);

create or replace function public.valida_soma_rateio()
returns trigger
language plpgsql
as $$
declare
  v_valor_total numeric(12,2);
  v_soma_itens numeric(12,2);
  v_lancamento_id uuid;
begin
  v_lancamento_id := coalesce(new.lancamento_custo_compartilhado_id, old.lancamento_custo_compartilhado_id);

  select valor_total into v_valor_total
  from public.lancamentos_custo_compartilhado
  where id = v_lancamento_id;

  select coalesce(sum(valor), 0) into v_soma_itens
  from public.rateio_custo_compartilhado_itens
  where lancamento_custo_compartilhado_id = v_lancamento_id;

  if v_soma_itens > v_valor_total then
    raise exception 'soma dos itens de rateio (%) difere do valor_total (%)', v_soma_itens, v_valor_total;
  end if;

  return new;
end;
$$;

create trigger valida_soma_rateio_trigger
  after insert or update on public.rateio_custo_compartilhado_itens
  for each row execute function public.valida_soma_rateio();

create policy "ver rateio de custo compartilhado"
  on public.lancamentos_custo_compartilhado for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_negocio', 'ver'));

create policy "lancar rateio de custo compartilhado"
  on public.lancamentos_custo_compartilhado for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_negocio', 'lancar'));

create policy "ver itens de rateio da propria propriedade"
  on public.rateio_custo_compartilhado_itens for select
  using (exists (
    select 1 from public.lancamentos_custo_compartilhado lcc
    where lcc.id = lancamento_custo_compartilhado_id
      and lcc.propriedade_id = public.usuario_propriedade_id()
      and public.tem_permissao('financeiro_negocio', 'ver')
  ));

create policy "lancar itens de rateio da propria propriedade"
  on public.rateio_custo_compartilhado_itens for insert
  with check (exists (
    select 1 from public.lancamentos_custo_compartilhado lcc
    where lcc.id = lancamento_custo_compartilhado_id
      and lcc.propriedade_id = public.usuario_propriedade_id()
      and public.tem_permissao('financeiro_negocio', 'lancar')
  ));
