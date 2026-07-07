const MENSAGENS: Record<string, string> = {
  credenciais_invalidas: 'E-mail ou senha inválidos.',
  nome_obrigatorio: 'Informe um nome.',
  dados_invalidos: 'Preencha todos os campos obrigatórios.',
  pessoa_invalida: 'Selecione uma pessoa válida.',
  perfil_invalido: 'Selecione um perfil de acesso válido.',
  senha_curta: 'A senha precisa ter pelo menos 6 caracteres.',
  email_duplicado: 'Já existe um usuário com este e-mail.',
  cpf_duplicado: 'Já existe uma pessoa cadastrada com este CPF.',
  nao_autorizado: 'Você não tem permissão para esta ação.',
  usuario_nao_encontrado: 'Usuário não encontrado.',
  data_invalida: 'Informe uma data válida.',
  data_aquisicao_invalida: 'Informe uma data de aquisição válida.',
  valores_invalidos: 'Os valores informados não podem ser negativos.',
  unidade_negocio_nao_encontrada: 'Nenhuma unidade de negócio de leite cadastrada para esta propriedade.',
  categoria_origem_invalida: 'Selecione uma categoria de origem diferente da categoria de destino.',
  quantidade_invalida: 'Informe uma quantidade maior que zero.',
  erro_inesperado: 'Algo deu errado. Tente novamente.',
}

export function mensagemErro(codigo: string | undefined): string | null {
  if (!codigo) {
    return null
  }
  return MENSAGENS[codigo] ?? MENSAGENS.erro_inesperado
}
