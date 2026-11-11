# Architecture

Study Tool is a Next.js application backed by Supabase. Each account has its own profile, imported notes, and assessment receipts. Supabase Auth handles sign-in; row-level security limits database access to the owning account.

## Data

- `study_profiles` stores learning goals and starting knowledge.
- `notes` stores Markdown files and their original vault paths.
- `lesson_progress` stores legacy v0.1 self-ratings. It is retained during the upgrade but no longer determines mastery.
- `assessment_receipts` stores pending, approved, and rejected evidence. The current score for a topic comes from its most recent approved receipt.

The curriculum is computed from notes rather than stored separately. Identifiers depend on the original path, so edits do not reset progress. Renaming a note changes that identifier.

## Source records

The source tables are a foundation for later importers. The current UI still reads and edits `notes`; it does not publish imports into these tables yet.

- `sources` identifies one owner's vault, repository, or conversation collection. Reimports must reuse this UUID; the display name is not an identity.
- `source_artifacts` identifies a file or conversation within that source. Its UUID stays the same across content updates. Paths and external IDs are unique within a source, so separate sources can both contain `README.md`.
- `source_revisions` stores full text and its SHA-256 hash. Identical content reuses a revision of the same artifact, including a return to older content. Matching content across different artifacts does not merge them.
- `source_imports` records accepted batches. `source_import_items` records each batch's artifact, revision, and path, including unchanged content and renames. A revision points to the batch that first accepted that content.

Authenticated owners can create sources and change their names. Other writes go through `accept_source_import(source_id, entries)`, which accepts 1–2,000 text entries in one transaction. For example, an entry can contain `{"external_id":"stable-file-id","path":"Lessons/Methods.md","content":"# Methods"}`. The function returns the accepted batch UUID.

The JSON batch is limited to 35 MiB, with at most 500,000 characters of content per entry. Optional paths and external IDs must be strings or null, with at most 1,024 UTF-8 bytes each. Oversized or malformed input rejects the batch. These limits bound database writes; a future adapter must also limit input before constructing the request.

A known external ID or an explicit artifact UUID can preserve identity through a rename. Without either, a new path creates a new artifact, even if its text matches. A new external ID at an occupied path requires explicit reconciliation with the existing artifact UUID. Conflicting IDs or occupied rename destinations reject the whole batch. This function accepts changes; it does not preview them, infer deleted files, or write to a vault.

The function locks the source while publishing, so imports into the same source run in order. A failed batch or disconnected transaction leaves no accepted changes. Row-level security limits reads to the owner, and composite foreign keys prevent references across accounts, sources, or artifacts. Clients cannot directly rewrite revision history or change current-revision pointers.

### Existing notes and progress

Migration `003_source_identities.sql` creates one `legacy_notes` source per account with notes. Each artifact reuses its note UUID and keeps its current path and text. These are migration-time snapshots, not recovered originals or a history of earlier edits. Later edits in the current note editor do not update the snapshots.

The migration does not change notes, profiles, legacy progress, or receipts. Curriculum IDs and assessment topics keep their existing path-based meaning. New source records are not added to the curriculum, and receipts are not attached to them by matching unqualified paths. Connecting source-aware imports to editable notes and progress requires a later, explicit compatibility change.

### Database checks

After applying all migrations to a disposable development database, run `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/source_identities.sql`. The script checks identity, revision reuse, atomic failure, and ownership, then rolls back its synthetic users and imports. It needs an administrative connection to create the test users and switch roles. These integration checks are separate from ordinary CI.

## Tutor handoff

The browser copies context when someone opens ChatGPT Web or Codex. Neither service is embedded and neither shares its conversation history with Study Tool.

## Import boundaries

Imported Markdown is treated as data, not instructions. Files from `.obsidian/`, chat archives, and generated progress folders are skipped. Raw HTML in Markdown is not executed. Imports and exported notes are scoped to the signed-in user.

## Known limits

There is no live Obsidian sync or automated model grading. Evidence is reviewed by the account owner. External AI models and hosted authentication would need their own supported integration and permission checks.
