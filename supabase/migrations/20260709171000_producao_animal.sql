create table public.producao_animal (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  animal_id uuid not null references public.animais(id) on delete restrict,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  data date not null,
  numero_ordenha smallint not null check (numero_ordenha > 0),
  litros numeric(10,2) not null check (litros >= 0),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (animal_id, data, numero_ordenha)
);

alter table public.producao_animal enable row level security;

create index producao_animal_propriedade_id_idx on public.producao_animal(propriedade_id);
create index producao_animal_animal_id_idx on public.producao_animal(animal_id);

create policy "ver producao por animal"
  on public.producao_animal for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar producao por animal"
  on public.producao_animal for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar producao por animal"
  on public.producao_animal for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create view public.producao_animal_total_dia
  with (security_invoker = true) as
select
  unidade_negocio_id,
  data,
  sum(litros) as total_produzido,
  count(distinct animal_id) as animais_lancados
from public.producao_animal
group by unidade_negocio_id, data;
