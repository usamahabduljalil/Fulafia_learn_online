export type AppRole = "teacher" | "student";
export type ClassAccessMode = "public" | "invite" | "approval";
export type EnrollmentStatus = "pending" | "active" | "rejected";
export type SessionStatus = "scheduled" | "active" | "completed" | "cancelled";
export type EngagementMode = "lecture" | "interactive";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassSummary {
  id: string;
  name: string;
  description: string | null;
  teacher_id: string;
  access_mode: ClassAccessMode;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  teacher?: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
  student_count?: number;
  engagement_score?: number;
}

export interface ClassSession {
  id: string;
  class_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  status: SessionStatus;
  engagement_mode: EngagementMode;
  livekit_room_name: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EngagementSnapshot {
  overall: number;
  attention: number;
  voice: number;
  screenFocus: number;
  facePresent: boolean;
  confidence: number;
  speakingSeconds: number;
  speakingTurns: number;
  wordCount: number;
}
