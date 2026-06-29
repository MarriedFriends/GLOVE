/**
 * Database types for the Supabase client.
 *
 * This is a hand-written starter that matches `supabase/schema.sql`. Once your
 * Supabase project is running, regenerate it from the live schema instead of
 * editing by hand:
 *
 *   npx supabase login
 *   npx supabase gen types typescript --project-id <your-project-ref> \
 *     > src/lib/supabase/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Gender = "male" | "female" | "nonbinary" | "other";
export type Preference = "male" | "female" | "everyone";
export type MatchStatus = "active" | "unmatched";
export type ReportReason =
  | "harassment"
  | "spam"
  | "inappropriate"
  | "fake"
  | "other";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string;
          university: string | null;
          gender: Gender | null;
          interested_in: Preference | null;
          birth_year: number | null;
          bio: string | null;
          avatar_url: string | null;
          is_verified: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          handle: string;
          university?: string | null;
          gender?: Gender | null;
          interested_in?: Preference | null;
          birth_year?: number | null;
          bio?: string | null;
          avatar_url?: string | null;
          is_verified?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          university?: string | null;
          gender?: Gender | null;
          interested_in?: Preference | null;
          birth_year?: number | null;
          bio?: string | null;
          avatar_url?: string | null;
          is_verified?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      likes: {
        Row: {
          liker_id: string;
          likee_id: string;
          is_like: boolean;
          created_at: string;
        };
        Insert: {
          liker_id: string;
          likee_id: string;
          is_like?: boolean;
          created_at?: string;
        };
        Update: {
          liker_id?: string;
          likee_id?: string;
          is_like?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "likes_liker_id_fkey";
            columns: ["liker_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "likes_likee_id_fkey";
            columns: ["likee_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      matches: {
        Row: {
          id: string;
          user_low: string;
          user_high: string;
          status: MatchStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_low: string;
          user_high: string;
          status?: MatchStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_low?: string;
          user_high?: string;
          status?: MatchStatus;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_user_low_fkey";
            columns: ["user_low"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_user_high_fkey";
            columns: ["user_high"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          match_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          sender_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          sender_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey";
            columns: ["match_id"];
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: {
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_id: string;
          reason: ReportReason;
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_id: string;
          reason: ReportReason;
          details?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          reported_id?: string;
          reason?: ReportReason;
          details?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reported_id_fkey";
            columns: ["reported_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
