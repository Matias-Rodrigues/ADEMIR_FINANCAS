create table public.vacinas_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  produto text not null,
  proxima_dose_prevista date,
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.vacinas_animal enable row level security;

create index vacinas_animal_propriedade_id_idx on public.vacinas_animal(propriedade_id);
create index vacinas_animal_animal_id_idx on public.vacinas_animal(animal_id);

create policy "ver vacinas de animal da propria propriedade"
  on public.vacinas_animal for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar vacinas de animal da propria propriedade"
  on public.vacinas_animal for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar vacinas de animal da propria propriedade"
  on public.vacinas_animal for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "excluir vacinas de animal da propria propriedade"
  on public.vacinas_animal for delete
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create table public.medicamentos_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  data date not null,
  produto text not null,
  dias_carencia integer not null check (dias_carencia >= 0),
  data_liberacao date generated always as (data + dias_carencia) stored,
  observacao text,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.medicamentos_animal enable row level security;

create index medicamentos_animal_propriedade_id_idx on public.medicamentos_animal(propriedade_id);
create index medicamentos_animal_animal_id_idx on public.medicamentos_animal(animal_id);

create policy "ver medicamentos de animal da propria propriedade"
  on public.medicamentos_animal for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar medicamentos de animal da propria propriedade"
  on public.medicamentos_animal for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar medicamentos de animal da propria propriedade"
  on public.medicamentos_animal for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "excluir medicamentos de animal da propria propriedade"
  on public.medicamentos_animal for delete
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));
