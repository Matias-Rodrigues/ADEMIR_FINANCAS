insert into public.propriedades (id, nome)
values ('00000000-0000-0000-0000-000000000001', 'Propriedade Ademir')
on conflict (id) do nothing;

insert into public.unidades_negocio (id, propriedade_id, nome, tipo) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Gado leiteiro', 'leite'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Suínos', 'suinos')
on conflict (id) do nothing;

insert into public.parcerias_integracao (id, propriedade_id, unidade_negocio_id, empresa_parceira, condicoes, ciclo_dias, forma_pagamento)
values (
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'Alibem Alimentos',
  'Fornece leitões, ração e assistência técnica. Contrato de exclusividade: não pode ter outros suínos na propriedade.',
  120,
  '30 dias após carregamento'
)
on conflict (id) do nothing;

insert into public.propriedade_modulos_contratados (id, propriedade_id, modulo, ativo) values
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'producao', true),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'financeiro_negocio', true),
  ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'financeiro_familiar', true),
  ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'credito_obrigacoes', true),
  ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'imobilizado', true),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'ponto_equilibrio', true),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000001', 'fiscal', true)
on conflict (id) do nothing;
