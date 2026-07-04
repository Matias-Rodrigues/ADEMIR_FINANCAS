create table public.imobilizados (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid references public.unidades_negocio(id) on delete set null,
  nome text not null,
  valor_aquisicao numeric(12,2) not null check (valor_aquisicao > 0),
  data_aquisicao date not null,
  vida_util_anos int not null check (vida_util_anos > 0),
  created_at timestamptz not null default now()
);

alter table public.imobilizados enable row level security;

create index imobilizados_propriedade_id_idx on public.imobilizados(propriedade_id);

create policy "ver imobilizados"
  on public.imobilizados for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('imobilizado', 'ver'));

create policy "lancar imobilizados"
  on public.imobilizados for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('imobilizado', 'lancar'));
