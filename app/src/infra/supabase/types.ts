export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      time_tracker_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          started_at: string;
          ended_at: string;
          duration_seconds: number;
          tags: string[] | null;
          project: string | null;
          project_id: string | null;
          theme_id: string | null;
          classification_path: string[] | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title: string;
          started_at: string;
          ended_at: string;
          duration_seconds: number;
          tags?: string[] | null;
          project?: string | null;
          project_id?: string | null;
          theme_id?: string | null;
          classification_path?: string[] | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['time_tracker_sessions']['Insert']
        >;
        Relationships: [];
      };
      time_tracker_running_states: {
        Row: {
          user_id: string;
          status: 'idle' | 'running';
          elapsed_seconds: number;
          draft: Json | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          status: 'idle' | 'running';
          elapsed_seconds?: number;
          draft?: Json | null;
          updated_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['time_tracker_running_states']['Insert']
        >;
        Relationships: [];
      };
      time_tracker_themes: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          status: 'active' | 'archived';
          color: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          owner_id: string;
          name: string;
          status?: 'active' | 'archived';
          color?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database['public']['Tables']['time_tracker_themes']['Insert']
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
