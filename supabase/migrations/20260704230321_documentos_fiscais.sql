create table public.documentos_fiscais (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  tipo text not null check (tipo in ('nfpe', 'boleto', 'cupom_fiscal', 'recibo', 'outro')),
  numero_documento text,
  valor numeric(12,2),
  data_emissao date,
  arquivo_url text,
  lancamento_financeiro_negocio_id uuid references public.lancamentos_financeiros_negocio(id) on delete set null,
  lancamento_financeiro_familiar_id uuid references public.lancamentos_financeiros_familiares(id) on delete set null,
  status_revisao text not null default 'pendente_revisao' check (status_revisao in ('pendente_revisao', 'confirmado', 'rejeitado')),
  created_at timestamptz not null default now()
);

alter table public.documentos_fiscais enable row level security;

create index documentos_fiscais_propriedade_id_idx on public.documentos_fiscais(propriedade_id);

create policy "ver documentos fiscais"
  on public.documentos_fiscais for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('fiscal', 'ver'));

create policy "lancar documentos fiscais"
  on public.documentos_fiscais for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('fiscal', 'lancar'));
