create or replace function public.usuario_eh_dev()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select papel = 'dev' from public.usuarios where id = auth.uid();
$$;
