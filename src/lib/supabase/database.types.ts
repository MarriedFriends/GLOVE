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
export type FaceType =
  | "dog"
  | "cat"
  | "fox"
  | "snake"
  | "mouse"
  | "bear"
  | "rabbit";
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
          admission_year: number | null;
          height_range: string | null;
          face_type: FaceType | null;
          mbti: string | null;
          hobbies: string[];
          smoking: string | null;
          date_freq: string | null;
          military: string | null;
          style: string | null;
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
          admission_year?: number | null;
          height_range?: string | null;
          face_type?: FaceType | null;
          mbti?: string | null;
          hobbies?: string[];
          smoking?: string | null;
          date_freq?: string | null;
          military?: string | null;
          style?: string | null;
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
          admission_year?: number | null;
          height_range?: string | null;
          face_type?: FaceType | null;
          mbti?: string | null;
          hobbies?: string[];
          smoking?: string | null;
          date_freq?: string | null;
          military?: string | null;
          style?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          is_verified?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      match_preferences: {
        Row: {
          user_id: string;
          mode: "date" | "friend";
          min_age: number;
          max_age: number;
          min_admission_year: number;
          max_admission_year: number;
          same_university: boolean;
          university_scope: "same" | "different" | "any";
          min_height_idx: number;
          max_height_idx: number;
          face_types: string[];
          hobby: string | null;
          intro: string;
          nonsmoker_only: boolean;
          military_only: boolean;
          pref_date_freqs: string[];
          pref_styles: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          mode?: "date" | "friend";
          min_age: number;
          max_age: number;
          min_admission_year: number;
          max_admission_year: number;
          same_university?: boolean;
          university_scope?: "same" | "different" | "any";
          min_height_idx: number;
          max_height_idx: number;
          face_types?: string[];
          hobby?: string | null;
          intro: string;
          nonsmoker_only?: boolean;
          military_only?: boolean;
          pref_date_freqs?: string[];
          pref_styles?: string[];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          mode?: "date" | "friend";
          min_age?: number;
          max_age?: number;
          min_admission_year?: number;
          max_admission_year?: number;
          same_university?: boolean;
          university_scope?: "same" | "different" | "any";
          min_height_idx?: number;
          max_height_idx?: number;
          face_types?: string[];
          hobby?: string | null;
          intro?: string;
          nonsmoker_only?: boolean;
          military_only?: boolean;
          pref_date_freqs?: string[];
          pref_styles?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "match_preferences_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_picks: {
        Row: {
          user_id: string;
          pick_date: string;
          candidate_id: string;
          score: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          pick_date: string;
          candidate_id: string;
          score?: number;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          pick_date?: string;
          candidate_id?: string;
          score?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_picks_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_picks_candidate_id_fkey";
            columns: ["candidate_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
          content: string | null;
          audio_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          sender_id: string;
          content?: string | null;
          audio_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          match_id?: string;
          sender_id?: string;
          content?: string | null;
          audio_path?: string | null;
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
      questions: {
        Row: {
          id: number;
          stage: number;
          ord: number;
          prompt: string;
        };
        Insert: {
          id: number;
          stage: number;
          ord: number;
          prompt: string;
        };
        Update: {
          id?: number;
          stage?: number;
          ord?: number;
          prompt?: string;
        };
        Relationships: [];
      };
      question_rounds: {
        Row: {
          id: string;
          match_id: string;
          question_id: number;
          round_no: number;
          status: "active" | "revealed" | "passed";
          low_submitted: boolean;
          high_submitted: boolean;
          low_next: boolean;
          high_next: boolean;
          passed_by: string | null;
          created_at: string;
          revealed_at: string | null;
        };
        Insert: {
          id?: string;
          match_id: string;
          question_id: number;
          round_no: number;
          status?: "active" | "revealed" | "passed";
          low_submitted?: boolean;
          high_submitted?: boolean;
          low_next?: boolean;
          high_next?: boolean;
          passed_by?: string | null;
          created_at?: string;
          revealed_at?: string | null;
        };
        Update: {
          id?: string;
          match_id?: string;
          question_id?: number;
          round_no?: number;
          status?: "active" | "revealed" | "passed";
          low_submitted?: boolean;
          high_submitted?: boolean;
          low_next?: boolean;
          high_next?: boolean;
          passed_by?: string | null;
          created_at?: string;
          revealed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "question_rounds_match_id_fkey";
            columns: ["match_id"];
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_rounds_question_id_fkey";
            columns: ["question_id"];
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
        ];
      };
      question_answers: {
        Row: {
          round_id: string;
          user_id: string;
          answer: string;
          submitted_at: string;
        };
        Insert: {
          round_id: string;
          user_id: string;
          answer: string;
          submitted_at?: string;
        };
        Update: {
          round_id?: string;
          user_id?: string;
          answer?: string;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_answers_round_id_fkey";
            columns: ["round_id"];
            referencedRelation: "question_rounds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_answers_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_reveals: {
        Row: {
          match_id: string;
          user_id: string;
          contact: string;
          created_at: string;
        };
        Insert: {
          match_id: string;
          user_id: string;
          contact: string;
          created_at?: string;
        };
        Update: {
          match_id?: string;
          user_id?: string;
          contact?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_reveals_match_id_fkey";
            columns: ["match_id"];
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_reveals_user_id_fkey";
            columns: ["user_id"];
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
    Functions: {
      process_pending_matches: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      request_next_question: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      ready_for_next: {
        Args: { p_match_id: string };
        Returns: undefined;
      };
      get_daily_candidates: {
        Args: Record<string, never>;
        Returns: {
          candidate_id: string;
          handle: string;
          university: string | null;
          age: number;
          admission_year: number;
          height_range: string;
          face_type: FaceType;
          mbti: string;
          hobbies: string[];
          smoking: string | null;
          date_freq: string | null;
          military: string | null;
          style: string | null;
          intro: string | null;
          score: number;
          liked: boolean;
        }[];
      };
      find_candidates: {
        Args: { max_results?: number };
        Returns: {
          candidate_id: string;
          handle: string;
          university: string | null;
          age: number;
          admission_year: number;
          height_range: string;
          face_type: FaceType;
          mbti: string;
          hobbies: string[];
          smoking: string | null;
          date_freq: string | null;
          military: string | null;
          style: string | null;
          intro: string | null;
          score: number;
        }[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
