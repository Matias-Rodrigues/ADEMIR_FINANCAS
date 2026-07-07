create table public.producao_leite (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  data date not null,
  litros_comercial numeric(10,2) not null default 0 check (litros_comercial >= 0),
  litros_descarte numeric(10,2) not null default 0 check (litros_descarte >= 0),
  litros_consumo numeric(10,2) not null default 0 check (litros_consumo >= 0),
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  unique (unidade_negocio_id, data)
);

alter table public.producao_leite enable row level security;

create index producao_leite_propriedade_id_idx on public.producao_leite(propriedade_id);
create index producao_leite_unidade_negocio_id_idx on public.producao_leite(unidade_negocio_id);

create policy "ver producao de leite"
  on public.producao_leite for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar producao de leite"
  on public.producao_leite for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
