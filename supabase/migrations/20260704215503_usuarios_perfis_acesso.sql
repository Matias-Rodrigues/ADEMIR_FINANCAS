create table public.perfis_acesso (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

alter table public.perfis_acesso enable row level security;

create table public.perfil_acesso_permissoes (
  id uuid primary key default gen_random_uuid(),
  perfil_acesso_id uuid not null references public.perfis_acesso(id) on delete cascade,
  modulo text not null check (modulo in (
    'producao', 'financeiro_negocio', 'financeiro_familiar', 'credito_obrigacoes',
    'imobilizado', 'ponto_equilibrio', 'fiscal', 'administracao_usuarios'
  )),
  pode_ver boolean not null default false,
  pode_lancar boolean not null default false,
  created_at timestamptz not null default now(),
  unique (perfil_acesso_id, modulo)
);

alter table public.perfil_acesso_permissoes enable row level security;

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  pessoa_fisica_id uuid references public.pessoas_fisicas(id) on delete set null,
  perfil_acesso_id uuid references public.perfis_acesso(id) on delete set null,
  papel text not null check (papel in ('admin', 'membro_familia', 'dev')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.usuarios enable row level security;

create index usuarios_propriedade_id_idx on public.usuarios(propriedade_id);

create or replace function public.usuario_propriedade_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select propriedade_id from public.usuarios where id = auth.uid();
$$;

create or replace function public.tem_permissao(p_modulo text, p_acao text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_papel text;
  v_perfil_id uuid;
  v_permitido boolean;
begin
  select papel, perfil_acesso_id into v_papel, v_perfil_id
  from public.usuarios where id = auth.uid();

  if v_papel = 'admin' then
    return true;
  end if;

  if v_perfil_id is null then
    return false;
  end if;

  if p_acao = 'ver' then
    select pode_ver into v_permitido from public.perfil_acesso_permissoes
      where perfil_acesso_id = v_perfil_id and modulo = p_modulo;
  else
    select pode_lancar into v_permitido from public.perfil_acesso_permissoes
      where perfil_acesso_id = v_perfil_id and modulo = p_modulo;
  end if;

  return coalesce(v_permitido, false);
end;
$$;

create policy "usuarios podem ver a própria linha"
  on public.usuarios for select
  using (id = auth.uid());
