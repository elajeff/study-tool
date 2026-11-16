# Architecture

Study Tool is a Next.js application backed by Supabase. Each account has its own profile, imported notes, and assessment receipts. Supabase Auth handles sign-in; row-level security limits database access to the owning account.

## Data

- `study_profiles` stores learning goals and starting knowledge.
- `notes` stores editable Markdown, display paths, and optional source/artifact links. `imported_revision_id` records the last source revision reviewed by the import workflow.
- `lesson_progress` stores legacy v0.1 self-ratings. It is retained during the upgrade but no longer determines mastery.
- `assessment_receipts` stores pending, approved, and rejected evidence. The current score for a topic comes from its most recent approved receipt.

The curriculum is computed from editable notes. Existing topic keys are retained in the artifact's read-only `legacy_topic`; new imported topics use `source/<artifact UUID>` and manual notes use `note/<note UUID>`. Lesson routes derive from these stable keys, so content updates and reconciled renames do not reset approved progress. Prerequisites and wikilinks resolve within one vault. Ambiguous names require a full path; unresolved prerequisites are reported and are not recommended as ready.

## Source records

Sources and artifacts also have short reading references, such as `R1/F001`. Migration 007 assigns them to existing records and new imports. They stay with the same record through content updates and confirmed renames; the UUIDs remain the database identities. Each owner's source numbering is separate.

The Obsidian importer publishes source records and editable notes together. Repository imports save source files without creating notes. A conversation adapter is not implemented.

- `sources` identifies one owner's vault, repository, or conversation collection. Reimports must reuse this UUID; the display name is not an identity.
- `source_artifacts` identifies a file or conversation within that source. Its UUID stays the same across content updates. Paths and external IDs are unique within a source, so separate sources can both contain `README.md`.
- `source_revisions` stores full text and its SHA-256 hash. Identical content reuses a revision of the same artifact, including a return to older content. Matching content across different artifacts does not merge them.
- `source_imports` records accepted batches. `source_import_items` records each batch's artifact, revision, and path, including unchanged content and renames. A revision points to the batch that first accepted that content.

Authenticated owners can create sources and change their names. Repository and conversation source writes go through `accept_source_import(source_id, entries)`, which accepts 1–2,000 text entries and returns the batch UUID. Repository entries require the preview references described below; conversation foundation calls retain optional external IDs. Vaults use the preview-checked Obsidian function. Both call `publish_source_import`, the shared publishing function that clients cannot execute directly.

The shared publisher limits JSON batches to 35 MiB and content to 500,000 characters per entry. Optional paths and external IDs must be strings or null, with at most 1,024 UTF-8 bytes each. Repository imports additionally require a path, preview references, and at most 500,000 UTF-8 bytes per file. Oversized or malformed input rejects the batch. Adapters also limit input before constructing requests.

The shared publisher resolves known external IDs or explicit artifact UUIDs to preserve identity through a rename. Without either, a new path creates a new artifact, even if its text matches. A new external ID at an occupied path requires explicit reconciliation with the existing artifact UUID. Conflicting IDs or occupied rename destinations reject the whole batch. The publisher accepts changes; it does not preview them, infer deleted files, or write to a vault.

The function locks the source while publishing, so imports into the same source run in order. A failed batch or disconnected transaction leaves no accepted changes. Row-level security limits reads to the owner, and composite foreign keys prevent references across accounts, sources, or artifacts. Clients cannot directly rewrite revision history or change current-revision pointers.

### Existing notes and progress

Migration `003_source_identities.sql` creates one `legacy_notes` source per account with notes. Each artifact reuses its note UUID and keeps its current path and text. These are migration-time snapshots, not recovered originals or a history of earlier edits. Later edits in the current note editor do not update the snapshots.

Migration `004` links these artifacts to editable notes without changing their text or approved receipts. Notes added between migrations receive additional labelled snapshots. Every legacy import baseline starts unconfirmed: the migration snapshot is never assumed to be the current editable text or the original vault file. Differing incoming text requires a choice before the first acceptance. Raw source-only records are not included in the curriculum, and matching paths in another vault never inherit existing assessments.

## Obsidian import and reimport

`vault_import_state` returns artifact identities, source revision IDs, and the last accepted import hashes. It includes editable text/hashes only for requested paths. The browser compares these with the selected files and displays a preview; it writes no file content until acceptance. Identical content does not create a second revision. Unknown paths are new artifacts unless the user explicitly selects an existing artifact for a rename. Missing files are retained, not treated as deletions.

ZIP entries are read in decompressed chunks, with at most 500,000 bytes retained per file. Oversized entries are paused and skipped before the full text is accumulated; declared sizes are not trusted. JSZip may finish processing its current compressed chunk after pausing.

`accept_obsidian_import` locks the owned vault and affected notes, then checks the source revision, previous path, and current editable text hash against the preview. Any mismatch rejects the whole batch. It calls the internal publisher and applies each keep/replace decision in the same transaction. Keeping local text still records the incoming raw revision. Deleting an editable note retains the artifact and its assessment alias; restoration requires a preview decision.

Clients can edit note bodies but cannot directly change source links, import baselines, or assessment aliases. The editor also checks its last-seen timestamp before saving and retains typed text if a concurrent save/import made it stale. Imports never change assessment approval or score calculations, and nothing is written back to Obsidian.

### Database checks

After applying all migrations to a disposable development database, run `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/source_identities.sql -f supabase/tests/obsidian_reimport.sql -f supabase/tests/source_relationships.sql -f supabase/tests/repository_import.sql`. The scripts check identity, revision reuse, local edits, stale previews, legacy assessment references, repository imports, path history, and ownership, then roll back their synthetic users and imports. They need an administrative connection to create the test users and switch roles. These integration checks are separate from ordinary CI.

## Explicit connections and provenance

`noteRelationships` is shared by wikilinks, curriculum prerequisites/recommendations, and the note connection list. It classifies named prerequisite/background sections, ignores fenced/inline code and attachment embeds, and returns the target, kind, heading, and one-based source line. Ordinary links never become prerequisites. No inferred relationships or assessment evidence are generated.

Relationships are calculated from the selected text, not cached in another table. Saved text is identified by source, artifact, and immutable revision UUIDs. Citations open that revision and its original import path at the recorded line. Current editable text is labelled separately if it differs; legacy collection snapshots are not presented as recovered originals. Changed imports use the artifact's current revision; historical revisions remain readable.

Migration `005` adds only `source_path_aliases`, a read-only security-invoker view over current artifacts and accepted import paths. Existing table RLS applies to the caller. Same-vault resolution uses artifact IDs across those paths, preserving links through confirmed renames. If a path is reused by another artifact, both identities remain candidates: the reference is ambiguous rather than silently reassigned. A target without an editable topic cannot satisfy a curriculum prerequisite. Assessment keys and calculations are unchanged.

## Repository imports

Repositories reuse sources, artifacts, revisions, and import runs. Files are source material only; the importer never creates editable notes or curriculum entries. The existing source reader displays current or retained revisions as escaped text. Vault note relationships stay scoped to their vault; no cross-source code connections are inferred.

`readImportFiles` shares ZIP streaming, text limits, hashing, and safe path handling with Obsidian. `matchImportFiles` shares identity matching and collision checks. Repository ZIPs keep their archive-relative paths; filenames determine supported formats and exclusions. The preview keeps incoming text in browser memory until acceptance. Local checks block known token/private-key patterns and leave uncertain credential values unselected. These advisory checks are not an exhaustive or server-side secret scanner.

Migration `006` requires owned repository calls to `accept_source_import` to supply preview artifact IDs, previous paths, and revision IDs. The source lock and all-entry checks reject stale previews, conflicting identities, and unsafe paths before the existing atomic publisher runs. Callers cannot bypass these checks through an older repository RPC; conversation-source publication retains its foundation contract for a later adapter. No tables or dependencies are added.

## Tutor handoff

The browser copies context when someone opens ChatGPT Web or Codex. Neither service is embedded and neither shares its conversation history with Study Tool.

## Import boundaries

Imported Markdown is treated as data, not instructions. Files from `.obsidian/`, chat archives, and generated progress folders are skipped. Raw HTML in Markdown is not executed. Imports and exported notes are scoped to the signed-in user.

## Known limits

There is no live Obsidian sync or automated model grading. Evidence is reviewed by the account owner. External AI models and hosted authentication would need their own supported integration and permission checks.
