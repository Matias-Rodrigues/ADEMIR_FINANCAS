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
