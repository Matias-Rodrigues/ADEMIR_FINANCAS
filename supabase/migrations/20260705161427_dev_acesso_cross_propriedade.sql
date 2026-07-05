-- usuarios (Task 3 do nucleo de dados)
drop policy "usuarios podem ver a própria linha" on public.usuarios;
create policy "usuarios podem ver a própria linha"
  on public.usuarios for select
  using (id = auth.uid() or public.usuario_eh_dev());

-- unidades_negocio (Task 4 do nucleo de dados)
drop policy "ver unidades de negocio da propria propriedade" on public.unidades_negocio;
create policy "ver unidades de negocio da propria propriedade"
  on public.unidades_negocio for select
  using (propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev());

drop policy "gerenciar unidades de negocio da propria propriedade" on public.unidades_negocio;
create policy "gerenciar unidades de negocio da propria propriedade"
  on public.unidades_negocio for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

-- eventos_operacionais (Task 5 do nucleo de dados)
drop policy "ver eventos operacionais da propria propriedade" on public.eventos_operacionais;
create policy "ver eventos operacionais da propria propriedade"
  on public.eventos_operacionais for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

drop policy "lancar eventos operacionais da propria propriedade" on public.eventos_operacionais;
create policy "lancar eventos operacionais da propria propriedade"
  on public.eventos_operacionais for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));

-- lancamentos_financeiros_negocio (Task 6 do nucleo de dados)
drop policy "ver lancamentos financeiros do negocio" on public.lancamentos_financeiros_negocio;
create policy "ver lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'ver'));

drop policy "lancar lancamentos financeiros do negocio" on public.lancamentos_financeiros_negocio;
create policy "lancar lancamentos financeiros do negocio"
  on public.lancamentos_financeiros_negocio for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'));

-- lancamentos_financeiros_familiares (Task 7 do nucleo de dados)
drop policy "ver lancamentos financeiros familiares" on public.lancamentos_financeiros_familiares;
create policy "ver lancamentos financeiros familiares"
  on public.lancamentos_financeiros_familiares for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_familiar', 'ver'));

drop policy "lancar lancamentos financeiros familiares" on public.lancamentos_financeiros_familiares;
create policy "lancar lancamentos financeiros familiares"
  on public.lancamentos_financeiros_familiares for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_familiar', 'lancar'));

-- lancamentos_custo_compartilhado (Task 8 do nucleo de dados)
drop policy "ver rateio de custo compartilhado" on public.lancamentos_custo_compartilhado;
create policy "ver rateio de custo compartilhado"
  on public.lancamentos_custo_compartilhado for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'ver'));

drop policy "lancar rateio de custo compartilhado" on public.lancamentos_custo_compartilhado;
create policy "lancar rateio de custo compartilhado"
  on public.lancamentos_custo_compartilhado for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('financeiro_negocio', 'lancar'));

-- rateio_custo_compartilhado_itens (Task 8 do nucleo de dados, ja com fix de permissao do commit c59fae8)
drop policy "ver itens de rateio da propria propriedade" on public.rateio_custo_compartilhado_itens;
create policy "ver itens de rateio da propria propriedade"
  on public.rateio_custo_compartilhado_itens for select
  using (exists (
    select 1 from public.lancamentos_custo_compartilhado lcc
    where lcc.id = lancamento_custo_compartilhado_id
      and (lcc.propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev())
      and public.tem_permissao('financeiro_negocio', 'ver')
  ));

drop policy "lancar itens de rateio da propria propriedade" on public.rateio_custo_compartilhado_itens;
create policy "lancar itens de rateio da propria propriedade"
  on public.rateio_custo_compartilhado_itens for insert
  with check (exists (
    select 1 from public.lancamentos_custo_compartilhado lcc
    where lcc.id = lancamento_custo_compartilhado_id
      and (lcc.propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev())
      and public.tem_permissao('financeiro_negocio', 'lancar')
  ));

-- obrigacoes_credito (Task 9 do nucleo de dados)
drop policy "ver obrigacoes de credito" on public.obrigacoes_credito;
create policy "ver obrigacoes de credito"
  on public.obrigacoes_credito for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('credito_obrigacoes', 'ver'));

drop policy "lancar obrigacoes de credito" on public.obrigacoes_credito;
create policy "lancar obrigacoes de credito"
  on public.obrigacoes_credito for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('credito_obrigacoes', 'lancar'));

-- parcelas_credito (Task 9 do nucleo de dados, ja com fix de permissao do commit c59fae8)
drop policy "ver parcelas de credito" on public.parcelas_credito;
create policy "ver parcelas de credito"
  on public.parcelas_credito for select
  using (exists (
    select 1 from public.obrigacoes_credito oc
    where oc.id = obrigacao_credito_id
      and (oc.propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev())
      and public.tem_permissao('credito_obrigacoes', 'ver')
  ));

drop policy "lancar parcelas de credito" on public.parcelas_credito;
create policy "lancar parcelas de credito"
  on public.parcelas_credito for insert
  with check (exists (
    select 1 from public.obrigacoes_credito oc
    where oc.id = obrigacao_credito_id
      and (oc.propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev())
      and public.tem_permissao('credito_obrigacoes', 'lancar')
  ));

-- imobilizados (Task 10 do nucleo de dados)
drop policy "ver imobilizados" on public.imobilizados;
create policy "ver imobilizados"
  on public.imobilizados for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'ver'));

drop policy "lancar imobilizados" on public.imobilizados;
create policy "lancar imobilizados"
  on public.imobilizados for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('imobilizado', 'lancar'));

-- documentos_fiscais (Task 11 do nucleo de dados)
drop policy "ver documentos fiscais" on public.documentos_fiscais;
create policy "ver documentos fiscais"
  on public.documentos_fiscais for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('fiscal', 'ver'));

drop policy "lancar documentos fiscais" on public.documentos_fiscais;
create policy "lancar documentos fiscais"
  on public.documentos_fiscais for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('fiscal', 'lancar'));

-- parcerias_integracao (Task 12 do nucleo de dados)
drop policy "ver parcerias de integracao" on public.parcerias_integracao;
create policy "ver parcerias de integracao"
  on public.parcerias_integracao for select
  using ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'ver'));

drop policy "lancar parcerias de integracao" on public.parcerias_integracao;
create policy "lancar parcerias de integracao"
  on public.parcerias_integracao for insert
  with check ((propriedade_id = public.usuario_propriedade_id() or public.usuario_eh_dev()) and public.tem_permissao('producao', 'lancar'));
