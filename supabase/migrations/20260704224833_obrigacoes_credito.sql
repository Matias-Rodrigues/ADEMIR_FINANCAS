create table public.obrigacoes_credito (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  instituicao text not null,
  tipo text not null check (tipo in ('emprestimo', 'consorcio', 'linha_credito', 'financiamento')),
  unidade_negocio_id uuid references public.unidades_negocio(id) on delete set null,
  valor_total numeric(12,2) not null check (valor_total > 0),
  data_contratacao date not null,
  created_at timestamptz not null default now()
);

alter table public.obrigacoes_credito enable row level security;

create table public.parcelas_credito (
  id uuid primary key default gen_random_uuid(),
  obrigacao_credito_id uuid not null references public.obrigacoes_credito(id) on delete cascade,
  numero_parcela int not null check (numero_parcela > 0),
  valor numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado')),
  data_pagamento date,
  created_at timestamptz not null default now(),
  unique (obrigacao_credito_id, numero_parcela)
);

alter table public.parcelas_credito enable row level security;

create index obrigacoes_credito_propriedade_id_idx on public.obrigacoes_credito(propriedade_id);
create index parcelas_credito_obrigacao_id_idx on public.parcelas_credito(obrigacao_credito_id);

create policy "ver obrigacoes de credito"
  on public.obrigacoes_credito for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('credito_obrigacoes', 'ver'));

create policy "lancar obrigacoes de credito"
  on public.obrigacoes_credito for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('credito_obrigacoes', 'lancar'));

create policy "ver parcelas de credito"
  on public.parcelas_credito for select
  using (exists (
    select 1 from public.obrigacoes_credito oc
    where oc.id = obrigacao_credito_id
      and oc.propriedade_id = public.usuario_propriedade_id()
      and public.tem_permissao('credito_obrigacoes', 'ver')
  ));

create policy "lancar parcelas de credito"
  on public.parcelas_credito for insert
  with check (exists (
    select 1 from public.obrigacoes_credito oc
    where oc.id = obrigacao_credito_id
      and oc.propriedade_id = public.usuario_propriedade_id()
      and public.tem_permissao('credito_obrigacoes', 'lancar')
  ));
