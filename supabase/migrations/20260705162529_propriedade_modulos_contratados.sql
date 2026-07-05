create table public.propriedade_modulos_contratados (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  modulo text not null check (modulo in (
    'producao', 'financeiro_negocio', 'financeiro_familiar',
    'credito_obrigacoes', 'imobilizado', 'ponto_equilibrio', 'fiscal'
  )),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (propriedade_id, modulo)
);

alter table public.propriedade_modulos_contratados enable row level security;

create index propriedade_modulos_contratados_propriedade_id_idx on public.propriedade_modulos_contratados(propriedade_id);

create policy "ver modulos contratados da propria propriedade"
  on public.propriedade_modulos_contratados for select
  using (propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev());

create policy "dev gerencia modulos contratados de qualquer propriedade"
  on public.propriedade_modulos_contratados for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());
