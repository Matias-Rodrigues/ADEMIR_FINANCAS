create table public.qualidade_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  mes date not null,
  ccs numeric(10,2) not null check (ccs >= 0),
  cbt numeric(10,2) not null check (cbt >= 0),
  gordura numeric(5,2) not null check (gordura >= 0 and gordura <= 100),
  proteina numeric(5,2) not null check (proteina >= 0 and proteina <= 100),
  esd numeric(5,2) not null check (esd >= 0 and esd <= 100),
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (unidade_negocio_id, mes)
);

alter table public.qualidade_leite enable row level security;

create index qualidade_leite_propriedade_id_idx on public.qualidade_leite(propriedade_id);
create index qualidade_leite_unidade_negocio_id_idx on public.qualidade_leite(unidade_negocio_id);

create policy "ver qualidade do leite"
  on public.qualidade_leite for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar qualidade do leite"
  on public.qualidade_leite for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));

create policy "editar qualidade do leite"
  on public.qualidade_leite for update
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'))
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
