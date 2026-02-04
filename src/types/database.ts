// Database types for Supabase

export type UserRole = 'auditor' | 'admin' | 'super_admin';
export type QuestionType = 'string' | 'number' | 'list' | 'radio' | 'checkbox';
export type QuestionnaireStatus = 'draft' | 'published' | 'archived';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  venue_name: string;
  venue_address: string | null;
  town_suburb: string | null;
  postcode: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  is_deleted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireVersion {
  id: string;
  version_number: number;
  name: string;
  description: string | null;
  status: QuestionnaireStatus;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  questionnaire_version_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  section_id: string;
  question_key: string;
  label: string;
  description: string | null;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  is_retired: boolean;
  retired_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id: string;
  facility_id: string;
  questionnaire_version_id: string;
  audit_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditAnswer {
  id: string;
  audit_id: string;
  question_id: string;
  value: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeLog {
  id: string;
  facility_id: string | null;
  audit_id: string | null;
  entity_type: 'facility' | 'audit_answer';
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
}

export interface TooltipConfig {
  id: string;
  field_source: 'facility' | 'question';
  field_key: string;
  display_label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FilterConfig {
  id: string;
  field_source: 'facility' | 'question';
  field_key: string;
  display_label: string;
  filter_type: 'select' | 'multi-select' | 'range' | 'text';
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface SectionWithQuestions extends Section {
  questions: Question[];
}

export interface QuestionnaireVersionWithSections extends QuestionnaireVersion {
  sections: SectionWithQuestions[];
}

export interface AuditWithAnswers extends Audit {
  audit_answers: AuditAnswer[];
  questionnaire_version: QuestionnaireVersion;
}

export interface FacilityWithAudits extends Facility {
  audits: AuditWithAnswers[];
  latest_audit?: AuditWithAnswers;
}

// Form types
export interface FacilityFormData {
  venue_name: string;
  venue_address: string;
  town_suburb: string;
  postcode: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
}

export interface AuditFormData {
  facility_id: string;
  questionnaire_version_id: string;
  audit_date: string;
  notes: string;
  answers: Record<string, string | string[]>;
}

export interface UserFormData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
}

// Database schema type for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      facilities: {
        Row: Facility;
        Insert: Omit<Facility, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Facility, 'id' | 'created_at'>>;
      };
      questionnaire_versions: {
        Row: QuestionnaireVersion;
        Insert: Omit<QuestionnaireVersion, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<QuestionnaireVersion, 'id' | 'created_at'>>;
      };
      sections: {
        Row: Section;
        Insert: Omit<Section, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Section, 'id' | 'created_at'>>;
      };
      questions: {
        Row: Question;
        Insert: Omit<Question, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Question, 'id' | 'created_at'>>;
      };
      audits: {
        Row: Audit;
        Insert: Omit<Audit, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Audit, 'id' | 'created_at'>>;
      };
      audit_answers: {
        Row: AuditAnswer;
        Insert: Omit<AuditAnswer, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AuditAnswer, 'id' | 'created_at'>>;
      };
      change_logs: {
        Row: ChangeLog;
        Insert: Omit<ChangeLog, 'id' | 'changed_at'>;
        Update: never; // Immutable
      };
      tooltip_config: {
        Row: TooltipConfig;
        Insert: Omit<TooltipConfig, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TooltipConfig, 'id' | 'created_at'>>;
      };
      filter_config: {
        Row: FilterConfig;
        Insert: Omit<FilterConfig, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FilterConfig, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      get_latest_published_questionnaire: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_latest_audit: {
        Args: { p_facility_id: string };
        Returns: string;
      };
    };
  };
}
