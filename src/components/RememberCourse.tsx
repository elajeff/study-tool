"use client";
import { useEffect } from "react";

export function RememberCourse({ userId, courseId, moduleIndex, stepId }: { userId: string; courseId: string; moduleIndex?: number; stepId?: string }) {
  useEffect(() => {
    document.cookie = `study-course-${userId}=${courseId}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    if (moduleIndex !== undefined) document.cookie = `study-position-${userId}=${courseId}.${moduleIndex}.${stepId ?? ""}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [userId, courseId, moduleIndex, stepId]);
  return null;
}
