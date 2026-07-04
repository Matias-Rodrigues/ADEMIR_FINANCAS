create table public.eventos_operacionais (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  unidade_negocio_id uuid not null references public.unidades_negocio(id) on delete restrict,
  tipo_evento text not null check (tipo_evento in ('producao', 'mortalidade', 'insumo', 'venda', 'ocorrencia_sanitaria')),
  data date not null,
  quantidade numeric,
  unidade_medida text,
  descricao text,
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.eventos_operacionais enable row level security;

create index eventos_operacionais_propriedade_id_idx on public.eventos_operacionais(propriedade_id);
create index eventos_operacionais_unidade_negocio_id_idx on public.eventos_operacionais(unidade_negocio_id);

create policy "ver eventos operacionais da propria propriedade"
  on public.eventos_operacionais for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'ver'));

create policy "lancar eventos operacionais da propria propriedade"
  on public.eventos_operacionais for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('producao', 'lancar'));
