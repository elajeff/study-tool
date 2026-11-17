import type { LibrarySource } from "./library-queries.ts";

export function repositoryDraftPrompt(exportId: string, source: LibrarySource): string {
  return `Use the ChatGPT Project containing Study Library export ${exportId}. Create a capability-based course draft for repository ${source.short_code} (${JSON.stringify(source.name)}).
Read its map, implementation, configuration and relevant tests yourself. Inventory actual capabilities and failure cases, then propose the foundations and module-specific independent proofs needed to understand, explain, debug and rebuild them. Cite the real items. Related notes/chats may personalize examples; they do not establish mastery.
Keep this draft scoped to ${source.short_code}. Other repositories will receive their own drafts; account for their items as outside this draft's scope. Return a complete study-course/1 block using export_id ${exportId} and the Project's course schema. Do not start teaching or return a partial JSON object. This is a proposed capability inventory, not a verified complete curriculum.`;
}
