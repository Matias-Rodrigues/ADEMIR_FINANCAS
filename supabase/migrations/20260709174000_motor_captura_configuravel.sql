create table public.configuracoes_captura_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estilo_interacao text not null default 'todos_visiveis'
    check (estilo_interacao in ('todos_visiveis', 'tocar_para_revelar')),
  exibir_categoria boolean not null default false,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (usuario_id)
);

alter table public.configuracoes_captura_animal enable row level security;

create index configuracoes_captura_animal_propriedade_id_idx on public.configuracoes_captura_animal(propriedade_id);
create index configuracoes_captura_animal_usuario_id_idx on public.configuracoes_captura_animal(usuario_id);

create policy "ver propria configuracao de captura ou dev ve qualquer uma"
  on public.configuracoes_captura_animal for select
  using (usuario_id = auth.uid() or public.usuario_eh_dev());

create policy "somente dev gerencia configuracao de captura"
  on public.configuracoes_captura_animal for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());

create table public.ordem_captura_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete cascade,
  posicao integer not null check (posicao > 0),
  created_at timestamptz not null default now(),
  unique (usuario_id, animal_id)
);

alter table public.ordem_captura_animal enable row level security;

create index ordem_captura_animal_propriedade_id_idx on public.ordem_captura_animal(propriedade_id);
create index ordem_captura_animal_usuario_id_idx on public.ordem_captura_animal(usuario_id);

create policy "ver propria ordem de captura ou dev ve qualquer uma"
  on public.ordem_captura_animal for select
  using (usuario_id = auth.uid() or public.usuario_eh_dev());

create policy "somente dev gerencia ordem de captura"
  on public.ordem_captura_animal for all
  using (public.usuario_eh_dev())
  with check (public.usuario_eh_dev());
