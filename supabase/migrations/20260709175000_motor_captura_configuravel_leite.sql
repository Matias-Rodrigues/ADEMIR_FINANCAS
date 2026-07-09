create table public.configuracoes_captura_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estilo_interacao text not null default 'todos_visiveis'
    check (estilo_interacao in ('todos_visiveis', 'tocar_para_revelar')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (usuario_id)
);

alter table public.configuracoes_captura_leite enable row level security;

create index configuracoes_captura_leite_propriedade_id_idx on public.configuracoes_captura_leite(propriedade_id);

create policy "ver propria configuracao de captura de leite ou dev ve qualquer uma"
  on public.configuracoes_captura_leite for select
  using (usuario_id = auth.uid() or public.usuario_eh_dev());

create policy "somente dev gerencia configuracao de captura de leite"
  on public.configuracoes_captura_leite for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());

create table public.ordem_captura_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  campo text not null check (campo in ('litros_comercial', 'litros_descarte', 'litros_consumo')),
  posicao integer not null check (posicao > 0),
  created_at timestamptz not null default now(),
  unique (usuario_id, campo)
);

alter table public.ordem_captura_leite enable row level security;

create index ordem_captura_leite_propriedade_id_idx on public.ordem_captura_leite(propriedade_id);
create index ordem_captura_leite_usuario_id_idx on public.ordem_captura_leite(usuario_id);

create policy "ver propria ordem de captura de leite ou dev ve qualquer uma"
  on public.ordem_captura_leite for select
  using (usuario_id = auth.uid() or public.usuario_eh_dev());

create policy "somente dev gerencia ordem de captura de leite"
  on public.ordem_captura_leite for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());
