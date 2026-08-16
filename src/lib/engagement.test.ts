import { describe, expect, it } from "vitest";
import { calculateOverallEngagement, interventionLevel } from "@/lib/engagement";

describe("engagement calculations", () => {
  it("uses lecture weights without penalizing silence", () => {
    expect(calculateOverallEngagement("lecture", 80, 50, 0)).toBe(68);
  });
  it("uses participation for interactive sessions", () => {
    expect(calculateOverallEngagement("interactive", 80, 60, 40)).toBe(61);
  });
  it("clamps malformed scores", () => {
    expect(calculateOverallEngagement("lecture", 150, -20, 0)).toBe(60);
  });
  it("nudges at 60 seconds and alerts at 120 seconds", () => {
    expect(interventionLevel([40, 45], [true, true])).toBe("student_nudge");
    expect(interventionLevel([40, 45, 30, 20], [true, true, true, true])).toBe("teacher_alert");
  });
  it("alerts after 90 seconds without a face", () => {
    expect(interventionLevel([80, 80, 80], [false, false, false])).toBe("teacher_alert");
  });
});
