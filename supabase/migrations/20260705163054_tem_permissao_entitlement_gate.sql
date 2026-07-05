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
  v_propriedade_id uuid;
  v_contratado boolean;
  v_permitido boolean;
begin
  select papel, perfil_acesso_id, propriedade_id into v_papel, v_perfil_id, v_propriedade_id
  from public.usuarios where id = auth.uid();

  if v_papel = 'dev' then
    return true;
  end if;

  if p_modulo <> 'administracao_usuarios' then
    select ativo into v_contratado
    from public.propriedade_modulos_contratados
    where propriedade_id = v_propriedade_id and modulo = p_modulo;

    if coalesce(v_contratado, false) = false then
      return false;
    end if;
  end if;

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
