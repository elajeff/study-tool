# Architecture

Study Tool is a Next.js application backed by Supabase. Each account owns its imported sources, editable notes, Library snapshots, courses and assessment receipts. Supabase Auth handles sign-in; row-level security limits database access to the owning account. Importing, organizing and planning require no AI API or local instruction model.

## Data

- `study_profiles` stores learning goals and starting knowledge.
- `notes` stores editable Markdown, display paths, and optional source/artifact links. `imported_revision_id` records the last source revision reviewed by the import workflow.
- `lesson_progress` stores legacy v0.1 self-ratings. It is retained during the upgrade but no longer determines mastery.
- `assessment_receipts` stores pending, approved, and rejected evidence. The current score for a topic comes from its most recent approved receipt.

The curriculum is computed from editable notes. Existing topic keys are retained in the artifact's read-only `legacy_topic`; new imported topics use `source/<artifact UUID>` and manual notes use `note/<note UUID>`. Lesson routes derive from these stable keys, so content updates and reconciled renames do not reset approved progress. Prerequisites and wikilinks resolve within one vault. Ambiguous names require a full path; unresolved prerequisites are reported and are not recommended as ready.

## Source records

Sources and artifacts also have short reading references, such as `R1/F001`. Migration 007 assigns them to existing records and new imports. They stay with the same record through content updates and confirmed renames; the UUIDs remain the database identities. Each owner's source numbering is separate.

Conversation imports use the provider's conversation ID within a selected source. Migration 008 accepts prepared transcripts and UTF-8 message offsets in one transaction. The RPC checks ownership, provider, message boundaries and expected saved revisions before publishing. Each accepted import keeps its metadata even when unchanged text reuses an existing revision. ChatGPT sources use `C` references, Claude sources use `K`, and conversations use `T` references. Saved conversations do not create editable notes or assessment evidence.

The Obsidian importer publishes source records and editable notes together. Repository and conversation imports save source text without creating notes. Conversation readers reconstruct the selected ChatGPT branch or Claude messages, preserve code and mathematics, and report omitted content. Reading pages break before user turns; they do not replace the saved transcript.

- `sources` identifies one owner's vault, repository, or conversation collection. Reimports must reuse this UUID; the display name is not an identity.
- `source_artifacts` identifies a file or conversation within that source. Its UUID stays the same across content updates. Paths and external IDs are unique within a source, so separate sources can both contain `README.md`.
- `source_revisions` stores full text and its SHA-256 hash. Identical content reuses a revision of the same artifact, including a return to older content. Matching content across different artifacts does not merge them.
- `source_imports` records accepted batches. `source_import_items` records each batch's artifact, revision, and path, including unchanged content and renames. A revision points to the batch that first accepted that content.

Authenticated owners can create sources and change their names. Repository writes use `accept_repository_import` to retain commit and exclusion metadata alongside the preview-checked source import. Conversations use `accept_conversation_import` to publish text, message offsets and reconstruction context together. Vaults use `accept_obsidian_import`. These functions reach `publish_source_import`, the shared publisher that clients cannot execute directly.

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

After applying all migrations to a disposable development database, run each file in `supabase/tests/` using `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f <script>`. The scripts check source identity, revision reuse, stale previews, ownership, frozen Library context, courses, lesson plans, summaries, repository origins and atomic Inbox imports. They roll back their test users and imports. They need an administrative connection to create users and switch roles. These database integration checks are separate from ordinary CI.

## Explicit connections and provenance

`noteRelationships` is shared by wikilinks, curriculum prerequisites/recommendations, and the note connection list. It classifies named prerequisite/background sections, ignores fenced/inline code and attachment embeds, and returns the target, kind, heading, and one-based source line. Ordinary links never become prerequisites. No inferred relationships or assessment evidence are generated.

Relationships are calculated from the selected text, not cached in another table. Saved text is identified by source, artifact, and immutable revision UUIDs. Citations open that revision and its original import path at the recorded line. Current editable text is labelled separately if it differs; legacy collection snapshots are not presented as recovered originals. Changed imports use the artifact's current revision; historical revisions remain readable.

Migration `005` adds only `source_path_aliases`, a read-only security-invoker view over current artifacts and accepted import paths. Existing table RLS applies to the caller. Same-vault resolution uses artifact IDs across those paths, preserving links through confirmed renames. If a path is reused by another artifact, both identities remain candidates: the reference is ambiguous rather than silently reassigned. A target without an editable topic cannot satisfy a curriculum prerequisite. Assessment keys and calculations are unchanged.

## Repository imports

Repositories reuse sources, artifacts, revisions, and import runs. Files are source material only; the importer never creates editable notes or curriculum entries. The existing source reader displays current or retained revisions as escaped text. Vault note relationships stay scoped to their vault; no cross-source code connections are inferred.

`readImportFiles` shares ZIP streaming, text limits, hashing, and safe path handling with Obsidian. `matchImportFiles` shares identity matching and collision checks. Local ZIPs keep their archive-relative paths. Public GitHub URLs resolve to a fixed commit before downloading, and their archive wrapper is removed. Downloads allow only GitHub's API and archive hosts, with a 30-second timeout and 20 MiB ZIP cap. Files are never executed.

The preview keeps incoming text in browser memory until acceptance. Known token/private-key patterns are blocked; uncertain credential values stay selected with a warning so examples remain readable. Users can deselect files. These advisory checks can miss secrets. Conversation reconstruction redacts recognized keys and tokens in derived text; original export files are not rewritten.

Repository calls supply preview artifact IDs, previous paths and revision IDs. The source lock and all-entry checks reject stale previews, conflicting identities and unsafe paths before publication. Saved origins describe the import that first stored each revision, not a verified current checkout. A collection can span imports; a local ZIP without recorded GitHub metadata has an unknown commit.

## Library snapshots and courses

`library_exports` stores an immutable manifest of selected source revisions, reading maps, accepted conversation context and recorded repository origins. Later imports do not change it. `source_digests` holds unverified navigation summaries; reuse requires matching text, path and reconstruction context. Matching summaries are frozen into new manifests. Learning history is included only when selected explicitly.

`buildLibraryFiles` renders that manifest and the exact source text with authoring instructions. It bounds files by UTF-8 bytes, keeps source items whole, and supplies an index when several data files are needed. Byte and character estimates are not a guarantee that an AI model reads every item. Downloading does not upload anything; users upload the files to ChatGPT themselves.

ChatGPT is asked to inspect maps and relevant source items, use general knowledge beyond the Library, and return a complete course outline. The app does not infer semantic prerequisites from keywords or certify AI explanations. Optional review requests check the original learning goal, prerequisite preparation and independent proofs. Portfolio requests prepare one course per repository, then combine selected courses from the same snapshot.

`courses` retains the returned outline and export reference. `course_modules` stores imported module plans; `course_steps` gives each lesson a persistent UUID. The Inbox parses supported response blocks, loads owned snapshots and course identities, and validates references, prerequisite order and required fields before one atomic save. A malformed block rejects the whole response. Identical reimports preserve existing identities; different saved module plans are rejected rather than replacing progress.

Lesson requests carry those saved identities, relevant source references and the latest approved assessment. ChatGPT teaches externally. Done/Reopen changes only `course_steps.completed_at`; continuation follows the first unfinished lesson and stops at modules without plans. The progress bar counts saved lessons, with unplanned modules reported separately. Assessment receipts begin pending and affect mastery only after owner review.

## Tutor handoff

The browser copies context when someone opens ChatGPT Web or Codex. Neither service is embedded and neither shares its conversation history with Study Tool.

## Import boundaries

Imported content is treated as data, not instructions. The Obsidian reader skips `.obsidian/`, raw chat archives and generated progress folders; conversation exports use their dedicated importer. ChatBridge references are checked against saved conversation identities to identify overlap. Raw HTML in Markdown is not executed. Imports and exported notes are scoped to the signed-in user.

## Known limits

There is no live Obsidian sync, supported ChatGPT Web automation or automated grading. Evidence is reviewed by the account owner. Structure and source accounting do not prove curriculum completeness or correct teaching. ChatGPT's upload allowance and retrieval behavior depend on the user's account and service; the app cannot guarantee access to every uploaded item. Supabase stores account data under the deployment's configuration and policies; this is not a local-only application.

## Hosted signup

Supabase's default sender delivers sign-in links only to project team addresses. To invite external users, verify a sender domain with an SMTP provider and configure it in Supabase Auth. Keep email verification enabled, allowlist the production `/auth/confirm` URL, and turn off email link tracking. Set Auth rate limits for the beta. Integrate and test CAPTCHA before enabling it on Supabase, since the client needs to submit a CAPTCHA token.

Use two external test accounts and sample imports. Verify first and returning sign-in, expired or used links, resend, and sign-out. In separate browser profiles, have each account import a sample, download its Library, save a course and mark a lesson done. Check that direct revision, snapshot, download and course URLs for account A fail under account B. Run the [database checks](#database-checks) for cross-account writes.

Before inviting users to import real material, give them a clear privacy notice and deletion contact, and verify backup and restore.
