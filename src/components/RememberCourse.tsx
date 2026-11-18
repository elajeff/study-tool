"use client";
import { useEffect } from "react";

export function RememberCourse({ userId, courseId }: { userId: string; courseId: string }) {
  useEffect(() => {
    document.cookie = `study-course-${userId}=${courseId}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }, [userId, courseId]);
  return null;
}
