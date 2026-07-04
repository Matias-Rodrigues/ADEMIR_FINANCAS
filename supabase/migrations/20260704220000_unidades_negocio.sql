create table public.unidades_negocio (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('leite', 'suinos', 'outro')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.unidades_negocio to postgres, authenticated;

alter table public.unidades_negocio enable row level security;

create index unidades_negocio_propriedade_id_idx on public.unidades_negocio(propriedade_id);

create policy "ver unidades de negocio da propria propriedade"
  on public.unidades_negocio for select
  using (propriedade_id = public.usuario_propriedade_id());

create policy "gerenciar unidades de negocio da propria propriedade"
  on public.unidades_negocio for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
