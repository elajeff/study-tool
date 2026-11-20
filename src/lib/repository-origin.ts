export type RepositoryOrigin = { format: "study-repository/1"; kind: "github" | "archive";
  url: string | null; commit: string | null; excluded: string[] };
export type ExportRepositoryOrigin = { import_id: string; source_id: string; origin: RepositoryOrigin };

export function repositoryOriginText(origin: ExportRepositoryOrigin): string {
  return `Repository import ${origin.import_id} (text first saved). ${origin.origin.kind === "github" ? `${origin.origin.url} at commit ${origin.origin.commit}` : "Local ZIP; original repository commit is unknown."}
Excluded paths in this import: ${origin.origin.excluded.length}.
This records this import only. Saved items may span imports; it is not a verified current checkout.`;
}
