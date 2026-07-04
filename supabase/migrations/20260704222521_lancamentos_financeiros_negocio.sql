create table public.lancamentos_financeiros_negocio (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  tipo text not null check (tipo in ('receita', 'despesa')),
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  descricao text,
  categoria text,
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.lancamentos_financeiros_negocio enable row level security;

create index lfn_propriedade_id_idx on public.lancamentos_financeiros_negocio(propriedade_id);
create index lfn_unidade_negocio_id_idx on public.lancamentos_financeiros_negocio(unidade_negocio_id);

create policy "ver lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_negocio', 'ver'));

create policy "lancar lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_negocio', 'lancar'));
