create table public.pesagens_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  peso_kg numeric(6,2) not null check (peso_kg > 0),
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.pesagens_animal enable row level security;

create index pesagens_animal_propriedade_id_idx on public.pesagens_animal(propriedade_id);
create index pesagens_animal_animal_id_idx on public.pesagens_animal(animal_id);

create policy "ver pesagens de animal da propria propriedade"
  on public.pesagens_animal for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar pesagens de animal da propria propriedade"
  on public.pesagens_animal for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar pesagens de animal da propria propriedade"
  on public.pesagens_animal for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "excluir pesagens de animal da propria propriedade"
  on public.pesagens_animal for delete
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));
