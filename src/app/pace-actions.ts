"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { parseStudyPace } from "@/lib/study-pace";

export async function saveStudyPace(_previous: { error: string } | null, form: FormData): Promise<{ error: string }> {
  const { user } = await requireAccount();
  const value = `${Math.round(Number(form.get("daily-hours")) * 60)}.${form.get("days")}.${form.get("minutes")}`;
  if (!parseStudyPace(value)) return { error: "Use 0.1–16 hours per day, 1–7 days per week and 5–240 minutes per lesson." };
  (await cookies()).set(`study-pace-${user.id}`, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31536000 });
  redirect("/dashboard");
}

export async function useWeeklyStudyHours() {
  const { user } = await requireAccount();
  (await cookies()).delete(`study-pace-${user.id}`);
  redirect("/dashboard");
}
