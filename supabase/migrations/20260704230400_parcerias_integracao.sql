create table public.parcerias_integracao (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete cascade,
  empresa_parceira text not null,
  condicoes text,
  ciclo_dias int,
  forma_pagamento text,
  created_at timestamptz not null default now()
);

alter table public.parcerias_integracao enable row level security;

create index parcerias_integracao_propriedade_id_idx on public.parcerias_integracao(propriedade_id);

create policy "ver parcerias de integracao"
  on public.parcerias_integracao for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar parcerias de integracao"
  on public.parcerias_integracao for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
