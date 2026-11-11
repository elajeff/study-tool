import type { SupabaseClient } from "@supabase/supabase-js";
import type { Assessment } from "./progress.ts";

export async function loadAssessments(supabase: SupabaseClient, status: "approved" | "pending", topic?: string) {
  const records: Assessment[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("assessment_receipts").select("*").eq("status", status);
    if (topic !== undefined) query = query.eq("topic", topic);
    const { data, error } = await query.order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load assessments. Check that the assessment migration was applied.");
    records.push(...data as Assessment[]);
    if (data.length < 500) return records;
  }
}
