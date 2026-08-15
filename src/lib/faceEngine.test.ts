import { describe, expect, it } from "vitest";
import { averageDescriptors, hasUsableVideoFrame } from "@/lib/faceEngine";

describe("face descriptor enrollment", () => {
  it("averages three 128-value descriptors", () => {
    const result = averageDescriptors([Array(128).fill(0), Array(128).fill(0.3), Array(128).fill(0.6)]);
    expect(result).toHaveLength(128);
    expect(result[0]).toBeCloseTo(0.3);
  });
  it("requires captures", () => expect(() => averageDescriptors([])).toThrow("No face captures"));
});

describe("camera frame readiness", () => {
  it("requires decoded dimensions before capture", () => {
    expect(hasUsableVideoFrame({ readyState: HTMLMediaElement.HAVE_CURRENT_DATA, videoWidth: 0, videoHeight: 0 } as HTMLVideoElement)).toBe(false);
    expect(hasUsableVideoFrame({ readyState: HTMLMediaElement.HAVE_CURRENT_DATA, videoWidth: 640, videoHeight: 480 } as HTMLVideoElement)).toBe(true);
  });
});
