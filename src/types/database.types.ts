// Сгенерировано командой: npm run gen:types
// НЕ редактируйте вручную — перегенерируйте после изменений схемы БД.
// Файл создан в формате `supabase gen types typescript` (schema: public).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: number
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: number
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: number
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recovery_codes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      reserved_usernames: {
        Row: {
          username: string
        }
        Insert: {
          username: string
        }
        Update: {
          username?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          ip: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          ip: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          ip?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          hidden: boolean
          id: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          hidden?: boolean
          id?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          hidden?: boolean
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: number
          message_id: number
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          message_id: number
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          id?: number
          message_id?: number
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reports_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'messages'
            referencedColumns: ['id']
          },
        ]
      }
      chat_mutes: {
        Row: {
          muted_until: string
          user_id: string
        }
        Insert: {
          muted_until: string
          user_id: string
        }
        Update: {
          muted_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_mutes_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_ip: string
          p_key: string
          p_window_seconds: number
          p_max: number
        }
        Returns: boolean
      }
      check_chat_rate_limit: {
        Args: {
          p_user_id: string
        }
        Returns: Json
      }
      chat_page: {
        Args: {
          p_cursor?: string
          p_cursor_id?: number
          p_limit?: number
        }
        Returns: Array<{
          content: string
          created_at: string
          id: number
          user_id: string
          username: string
        }>
      }
      verify_user_password: {
        Args: {
          p_email: string
          p_password: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrAlias extends keyof (DefaultSchema['Tables'] &
    DefaultSchema['Views']) = keyof (DefaultSchema['Tables'] & DefaultSchema['Views']),
> = (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrAlias]['Row']

export type TablesInsert<
  DefaultSchemaTableNameOrAlias extends keyof DefaultSchema['Tables'] = keyof DefaultSchema['Tables'],
> = DefaultSchema['Tables'][DefaultSchemaTableNameOrAlias]['Insert']

export type TablesUpdate<
  DefaultSchemaTableNameOrAlias extends keyof DefaultSchema['Tables'] = keyof DefaultSchema['Tables'],
> = DefaultSchema['Tables'][DefaultSchemaTableNameOrAlias]['Update']

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] = keyof DefaultSchema['Enums'],
> = DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes'] = keyof DefaultSchema['CompositeTypes'],
> = DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
