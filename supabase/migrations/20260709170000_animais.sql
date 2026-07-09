create table public.animais (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  brinco text not null,
  nome text,
  sexo text not null check (sexo in ('femea', 'macho')),
  categoria text not null check (categoria in (
    'vaca_lactacao', 'vaca_descarte', 'vaca_seca',
    'novilha_coberta', 'novilha_recria', 'terneira_aleitamento'
  )),
  data_nascimento date,
  mae_id uuid references public.animais(id) on delete set null,
  pai_texto text,
  ativo boolean not null default true,
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (propriedade_id, brinco)
);

alter table public.animais enable row level security;

create index animais_propriedade_id_idx on public.animais(propriedade_id);

create policy "ver animais da propria propriedade"
  on public.animais for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

create policy "lancar animais da propria propriedade"
  on public.animais for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

create policy "editar animais da propria propriedade"
  on public.animais for update
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'))
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));
