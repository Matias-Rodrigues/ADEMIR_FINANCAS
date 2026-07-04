create table public.propriedades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

alter table public.propriedades enable row level security;

create table public.pessoas_fisicas (
  id uuid primary key default gen_random_uuid(),
  propriedade_id uuid not null references public.propriedades(id) on delete cascade,
  nome text not null,
  cpf text not null unique,
  created_at timestamptz not null default now()
);

alter table public.pessoas_fisicas enable row level security;

create index pessoas_fisicas_propriedade_id_idx on public.pessoas_fisicas(propriedade_id);
