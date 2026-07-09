alter table public.producao_leite
  add column observacoes text,
  add column transcricao text,
  add column audio_paths text[];

alter table public.producao_leite drop constraint producao_leite_origem_check;
alter table public.producao_leite add constraint producao_leite_origem_check
  check (origem in ('whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'planilha', 'manual', 'app_audio'));

insert into storage.buckets (id, name, public) values ('capturas-audio', 'capturas-audio', false);

create policy "upload de audio da propria propriedade"
  on storage.objects for insert
  with check (
    bucket_id = 'capturas-audio'
    and (storage.foldername(name))[1] = (public.usuario_propriedade_id())::text
  );

create policy "leitura de audio da propria propriedade"
  on storage.objects for select
  using (
    bucket_id = 'capturas-audio'
    and (storage.foldername(name))[1] = (public.usuario_propriedade_id())::text
  );
