"use client";
import { useEffect } from "react";
import { updateCoursePositions } from "@/lib/course-position";

export function RememberCourse({ userId, courseId, moduleIndex, stepId }: { userId: string; courseId: string; moduleIndex?: number; stepId?: string }) {
  useEffect(() => {
    document.cookie = `study-course-${userId}=${courseId}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    if (moduleIndex !== undefined) {
      const key = `study-position-${userId}`;
      const previous = document.cookie.split("; ").find(cookie => cookie.startsWith(`${key}=`))?.slice(key.length + 1);
      const positions = updateCoursePositions(previous, courseId, `${moduleIndex}.${stepId ?? ""}`);
      document.cookie = `${key}=${positions}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    }
  }, [userId, courseId, moduleIndex, stepId]);
  return null;
}
