create table public.lancamentos_financeiros_familiares (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  pessoa_fisica_id uuid references public.pessoas_fisicas(id) on delete restrict,
  eh_consolidado_familiar boolean not null default false,
  tipo text not null check (tipo in ('receita', 'despesa')),
  valor numeric(12,2) not null check (valor > 0),
  data date not null,
  descricao text,
  categoria text,
  origem text not null default 'manual' check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual')),
  criado_por uuid not null references public.usuarios(id),
  created_at timestamptz not null default now(),
  constraint lff_consolidado_sem_cpf_check check (
    (eh_consolidado_familiar = true and pessoa_fisica_id is null)
    or
    (eh_consolidado_familiar = false and pessoa_fisica_id is not null)
  )
);

alter table public.lancamentos_financeiros_familiares enable row level security;

create index lff_propriedade_id_idx on public.lancamentos_financeiros_familiares(propriedade_id);
create index lff_pessoa_fisica_id_idx on public.lancamentos_financeiros_familiares(pessoa_fisica_id);

create policy "ver lancamentos financeiros familiares"
  on public.lancamentos_financeiros_familiares for select
  using (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_familiar', 'ver'));

create policy "lancar lancamentos financeiros familiares"
  on public.lancamentos_financeiros_familiares for insert
  with check (propriedade_id = public.usuario_propriedade_id() and public.tem_permissao('financeiro_familiar', 'lancar'));
