import type { EngagementMode } from "@/types/domain";

export function calculateOverallEngagement(mode: EngagementMode, attention: number, screenFocus: number, voice: number) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const safeAttention = clamp(attention); const safeScreen = clamp(screenFocus); const safeVoice = clamp(voice);
  return Math.round(mode === "interactive"
    ? safeAttention * 0.4 + safeScreen * 0.25 + safeVoice * 0.35
    : safeAttention * 0.6 + safeScreen * 0.4);
}

export function interventionLevel(recentOverall: number[], recentFacePresence: boolean[]) {
  const consecutiveLow = recentOverall.findIndex((value) => value >= 50);
  const lowCount = consecutiveLow === -1 ? recentOverall.length : consecutiveLow;
  const firstPresent = recentFacePresence.findIndex(Boolean);
  const absentCount = firstPresent === -1 ? recentFacePresence.length : firstPresent;
  if (lowCount >= 4 || absentCount >= 3) return "teacher_alert" as const;
  if (lowCount >= 2) return "student_nudge" as const;
  return "none" as const;
}
