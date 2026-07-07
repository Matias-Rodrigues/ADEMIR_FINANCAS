export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      documentos_fiscais: {
        Row: {
          arquivo_url: string | null
          created_at: string
          data_emissao: string | null
          id: string
          lancamento_financeiro_familiar_id: string | null
          lancamento_financeiro_negocio_id: string | null
          numero_documento: string | null
          propriedade_id: string
          status_revisao: string
          tipo: string
          valor: number | null
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          lancamento_financeiro_familiar_id?: string | null
          lancamento_financeiro_negocio_id?: string | null
          numero_documento?: string | null
          propriedade_id: string
          status_revisao?: string
          tipo: string
          valor?: number | null
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string
          data_emissao?: string | null
          id?: string
          lancamento_financeiro_familiar_id?: string | null
          lancamento_financeiro_negocio_id?: string | null
          numero_documento?: string | null
          propriedade_id?: string
          status_revisao?: string
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_fiscais_lancamento_financeiro_familiar_id_fkey"
            columns: ["lancamento_financeiro_familiar_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_financeiros_familiares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_fiscais_lancamento_financeiro_negocio_id_fkey"
            columns: ["lancamento_financeiro_negocio_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_financeiros_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_fiscais_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_operacionais: {
        Row: {
          categoria_animal: string | null
          categoria_origem: string | null
          created_at: string
          criado_por: string
          data: string
          descricao: string | null
          id: string
          origem: string
          propriedade_id: string
          quantidade: number | null
          tipo_evento: string
          unidade_medida: string | null
          unidade_negocio_id: string
        }
        Insert: {
          categoria_animal?: string | null
          categoria_origem?: string | null
          created_at?: string
          criado_por: string
          data: string
          descricao?: string | null
          id?: string
          origem?: string
          propriedade_id: string
          quantidade?: number | null
          tipo_evento: string
          unidade_medida?: string | null
          unidade_negocio_id: string
        }
        Update: {
          categoria_animal?: string | null
          categoria_origem?: string | null
          created_at?: string
          criado_por?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          propriedade_id?: string
          quantidade?: number | null
          tipo_evento?: string
          unidade_medida?: string | null
          unidade_negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_operacionais_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_operacionais_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_operacionais_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      imobilizados: {
        Row: {
          created_at: string
          data_aquisicao: string
          id: string
          nome: string
          propriedade_id: string
          unidade_negocio_id: string | null
          valor_aquisicao: number
          vida_util_anos: number
        }
        Insert: {
          created_at?: string
          data_aquisicao: string
          id?: string
          nome: string
          propriedade_id: string
          unidade_negocio_id?: string | null
          valor_aquisicao: number
          vida_util_anos: number
        }
        Update: {
          created_at?: string
          data_aquisicao?: string
          id?: string
          nome?: string
          propriedade_id?: string
          unidade_negocio_id?: string | null
          valor_aquisicao?: number
          vida_util_anos?: number
        }
        Relationships: [
          {
            foreignKeyName: "imobilizados_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imobilizados_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_custo_compartilhado: {
        Row: {
          created_at: string
          criado_por: string
          data: string
          descricao: string
          id: string
          propriedade_id: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          criado_por: string
          data: string
          descricao: string
          id?: string
          propriedade_id: string
          valor_total: number
        }
        Update: {
          created_at?: string
          criado_por?: string
          data?: string
          descricao?: string
          id?: string
          propriedade_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_custo_compartilhado_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_custo_compartilhado_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_financeiros_familiares: {
        Row: {
          categoria: string | null
          created_at: string
          criado_por: string
          data: string
          descricao: string | null
          eh_consolidado_familiar: boolean
          id: string
          origem: string
          pessoa_fisica_id: string | null
          propriedade_id: string
          tipo: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          criado_por: string
          data: string
          descricao?: string | null
          eh_consolidado_familiar?: boolean
          id?: string
          origem?: string
          pessoa_fisica_id?: string | null
          propriedade_id: string
          tipo: string
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          criado_por?: string
          data?: string
          descricao?: string | null
          eh_consolidado_familiar?: boolean
          id?: string
          origem?: string
          pessoa_fisica_id?: string | null
          propriedade_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_financeiros_familiares_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_familiares_pessoa_fisica_id_fkey"
            columns: ["pessoa_fisica_id"]
            isOneToOne: false
            referencedRelation: "pessoas_fisicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_familiares_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_financeiros_negocio: {
        Row: {
          categoria: string | null
          created_at: string
          criado_por: string
          data: string
          descricao: string | null
          id: string
          origem: string
          propriedade_id: string
          tipo: string
          unidade_negocio_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          criado_por: string
          data: string
          descricao?: string | null
          id?: string
          origem?: string
          propriedade_id: string
          tipo: string
          unidade_negocio_id: string
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          criado_por?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          propriedade_id?: string
          tipo?: string
          unidade_negocio_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_financeiros_negocio_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_negocio_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_negocio_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      obrigacoes_credito: {
        Row: {
          created_at: string
          data_contratacao: string
          id: string
          instituicao: string
          propriedade_id: string
          tipo: string
          unidade_negocio_id: string | null
          valor_total: number
        }
        Insert: {
          created_at?: string
          data_contratacao: string
          id?: string
          instituicao: string
          propriedade_id: string
          tipo: string
          unidade_negocio_id?: string | null
          valor_total: number
        }
        Update: {
          created_at?: string
          data_contratacao?: string
          id?: string
          instituicao?: string
          propriedade_id?: string
          tipo?: string
          unidade_negocio_id?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "obrigacoes_credito_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obrigacoes_credito_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_credito: {
        Row: {
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          obrigacao_credito_id: string
          status: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          obrigacao_credito_id: string
          status?: string
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          obrigacao_credito_id?: string
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_credito_obrigacao_credito_id_fkey"
            columns: ["obrigacao_credito_id"]
            isOneToOne: false
            referencedRelation: "obrigacoes_credito"
            referencedColumns: ["id"]
          },
        ]
      }
      parcerias_integracao: {
        Row: {
          ciclo_dias: number | null
          condicoes: string | null
          created_at: string
          empresa_parceira: string
          forma_pagamento: string | null
          id: string
          propriedade_id: string
          unidade_negocio_id: string
        }
        Insert: {
          ciclo_dias?: number | null
          condicoes?: string | null
          created_at?: string
          empresa_parceira: string
          forma_pagamento?: string | null
          id?: string
          propriedade_id: string
          unidade_negocio_id: string
        }
        Update: {
          ciclo_dias?: number | null
          condicoes?: string | null
          created_at?: string
          empresa_parceira?: string
          forma_pagamento?: string | null
          id?: string
          propriedade_id?: string
          unidade_negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcerias_integracao_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcerias_integracao_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_acesso_permissoes: {
        Row: {
          created_at: string
          id: string
          modulo: string
          perfil_acesso_id: string
          pode_lancar: boolean
          pode_ver: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          modulo: string
          perfil_acesso_id: string
          pode_lancar?: boolean
          pode_ver?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          modulo?: string
          perfil_acesso_id?: string
          pode_lancar?: boolean
          pode_ver?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "perfil_acesso_permissoes_perfil_acesso_id_fkey"
            columns: ["perfil_acesso_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_acesso: {
        Row: {
          created_at: string
          id: string
          nome: string
          propriedade_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          propriedade_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          propriedade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_acesso_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas_fisicas: {
        Row: {
          cpf: string
          created_at: string
          id: string
          nome: string
          propriedade_id: string
        }
        Insert: {
          cpf: string
          created_at?: string
          id?: string
          nome: string
          propriedade_id: string
        }
        Update: {
          cpf?: string
          created_at?: string
          id?: string
          nome?: string
          propriedade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_fisicas_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_leite: {
        Row: {
          created_at: string
          criado_por: string
          data: string
          id: string
          litros_comercial: number
          litros_consumo: number
          litros_descarte: number
          origem: string
          propriedade_id: string
          unidade_negocio_id: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          data: string
          id?: string
          litros_comercial?: number
          litros_consumo?: number
          litros_descarte?: number
          origem?: string
          propriedade_id: string
          unidade_negocio_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          data?: string
          id?: string
          litros_comercial?: number
          litros_consumo?: number
          litros_descarte?: number
          origem?: string
          propriedade_id?: string
          unidade_negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_leite_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_leite_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producao_leite_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      propriedade_modulos_contratados: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          modulo: string
          propriedade_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          modulo: string
          propriedade_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          modulo?: string
          propriedade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "propriedade_modulos_contratados_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      propriedades: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      qualidade_leite: {
        Row: {
          cbt: number
          ccs: number
          created_at: string
          criado_por: string
          esd: number
          gordura: number
          id: string
          mes: string
          origem: string
          propriedade_id: string
          proteina: number
          unidade_negocio_id: string
        }
        Insert: {
          cbt: number
          ccs: number
          created_at?: string
          criado_por: string
          esd: number
          gordura: number
          id?: string
          mes: string
          origem?: string
          propriedade_id: string
          proteina: number
          unidade_negocio_id: string
        }
        Update: {
          cbt?: number
          ccs?: number
          created_at?: string
          criado_por?: string
          esd?: number
          gordura?: number
          id?: string
          mes?: string
          origem?: string
          propriedade_id?: string
          proteina?: number
          unidade_negocio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualidade_leite_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualidade_leite_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualidade_leite_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      rateio_custo_compartilhado_itens: {
        Row: {
          created_at: string
          destino_tipo: string
          id: string
          lancamento_custo_compartilhado_id: string
          unidade_negocio_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          destino_tipo: string
          id?: string
          lancamento_custo_compartilhado_id: string
          unidade_negocio_id?: string | null
          valor: number
        }
        Update: {
          created_at?: string
          destino_tipo?: string
          id?: string
          lancamento_custo_compartilhado_id?: string
          unidade_negocio_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "rateio_custo_compartilhado_it_lancamento_custo_compartilha_fkey"
            columns: ["lancamento_custo_compartilhado_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_custo_compartilhado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_custo_compartilhado_itens_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_negocio: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          propriedade_id: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          propriedade_id: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          propriedade_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_negocio_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          papel: string
          perfil_acesso_id: string | null
          pessoa_fisica_id: string | null
          propriedade_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          papel: string
          perfil_acesso_id?: string | null
          pessoa_fisica_id?: string | null
          propriedade_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          papel?: string
          perfil_acesso_id?: string | null
          pessoa_fisica_id?: string | null
          propriedade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_perfil_acesso_id_fkey"
            columns: ["perfil_acesso_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_pessoa_fisica_id_fkey"
            columns: ["pessoa_fisica_id"]
            isOneToOne: false
            referencedRelation: "pessoas_fisicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_propriedade_id_fkey"
            columns: ["propriedade_id"]
            isOneToOne: false
            referencedRelation: "propriedades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      producao_leite_mensal: {
        Row: {
          litros_comercial: number | null
          litros_consumo: number | null
          litros_descarte: number | null
          media_diaria: number | null
          media_por_vaca_lactacao_dia: number | null
          mes: string | null
          producao_total: number | null
          unidade_negocio_id: string | null
          vacas_lactacao: number | null
        }
        Relationships: [
          {
            foreignKeyName: "producao_leite_unidade_negocio_id_fkey"
            columns: ["unidade_negocio_id"]
            isOneToOne: false
            referencedRelation: "unidades_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      rebanho_composicao: {
        Args: { p_data: string; p_unidade_negocio_id: string }
        Returns: {
          categoria: string
          quantidade: number
        }[]
      }
      tem_permissao: {
        Args: { p_acao: string; p_modulo: string }
        Returns: boolean
      }
      usuario_eh_admin: { Args: never; Returns: boolean }
      usuario_eh_dev: { Args: never; Returns: boolean }
      usuario_propriedade_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

