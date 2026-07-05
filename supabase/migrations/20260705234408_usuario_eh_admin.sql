create or replace function public.usuario_eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select papel = 'admin' from public.usuarios where id = auth.uid();
$$;
