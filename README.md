# Study Tool

Study Tool turns Markdown notes into a study roadmap. It supports Obsidian vault imports, practice topics, reviewed assessments, and handoffs to ChatGPT Web or Codex.

The roadmap follows the material each person imports. No standard course is assigned to every account.

## Features

- Email sign-in and private workspaces using Supabase Auth and row-level security.
- Markdown import, editing, and export.
- Local repository ZIP previews and source-file browsing.
- Study topics and prerequisite links drawn from source notes.
- Progress and review reminders based on approved assessments.
- ChatGPT Web as the default tutor, with an optional Codex handoff. Both open in their official sites.

## Setup

Requires Node.js 22.13 or newer within the Node 22 release line, or Node.js 24+, and a Supabase project. The baseline is verified with Node.js 24.22.0 and npm 11.19.1. The committed lockfile records the resolved dependency versions.

1. Run `npm ci` to install the locked dependencies.
2. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable/anon key. Do not use the service-role key.
3. Set up the database in the Supabase SQL Editor:
   - **Fresh installation:** run `supabase/schema.sql`, then numbered migrations `002` through `018` from `supabase/`, in order.
   - **Upgrade from v0.1:** run numbered migrations `002` through `018` against the existing database. Do not rerun `schema.sql`; it creates tables and policies that already exist.
   - **Existing v0.2 database:** apply any missing numbered migrations in order. A database with `017` already applied needs only `018`.
   - Apply each file once. They create tables or policies that already exist if rerun.

   The migrations retain existing notes, profiles, progress, and assessment receipts. Existing assessment topic keys are kept when notes are linked to source artifacts. Legacy self-ratings no longer determine mastery; approved assessment receipts do.
4. Enable email sign-in in Supabase Authentication. Set the Site URL to `http://localhost:3000` for development and allow `http://localhost:3000/auth/confirm` as a redirect.
5. For the email sign-in callback, use this link in the Supabase email template:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to Study Tool</a>
   ```

6. Run `npm run dev` and open `http://localhost:3000`.

For deployment, configure the production site URL and redirect URL in Supabase, and set the same public environment variables on the Next.js host. Configure production SMTP, backups, rate limits, and a privacy notice before opening registration.

## Obsidian

Create or select a vault on the Notes page, then preview `.md` files or a ZIP containing Markdown. Reuse that vault when reimporting; its UUID identifies the collection independently of its name. Different vaults can contain the same path. The app uses these folders when present:

- `Lessons/Java/`, `DSA/`, and `Foundations/` for the main study tracks.
- `Concepts/` for technical reference topics.
- `Learning Projects/` for project practice.
- `Walkthroughs/` for implementation traces.

Other Markdown collections can be used too. Obsidian configuration, chat archives, and generated progress reports are skipped during import. Prerequisites are read from explicitly named sections, not from every wikilink.

The preview compares incoming files with the current editable notes and the last accepted import. Local edits are kept when the source is unchanged. Conflicting changes require a choice. For a rename, select the existing artifact; matching text alone never merges files. Files absent from the selection are kept.

Legacy migration snapshots have no trusted import baseline. If their current text differs from an incoming file, review both versions and choose which editable text to keep. Existing assessment keys stay attached to the same artifacts through renames and note restoration.

Imports accept at most 2,000 notes, 500,000 UTF-8 bytes per file, a 20 MiB ZIP, and 35 MiB of JSON per batch. Oversized or excluded files are counted in the preview. Exporting a selected vault keeps its paths; exporting all notes uses separate folders by vault ID to prevent collisions. Manual notes can also be exported separately.

Import and export are manual. Nothing is written to the original vault, and there is no live sync or automatic ChatGPT conversation import.

The note editor shows explicit links, prerequisites, and recommendations. Source citations open the saved revision at the relevant line. Local edits are shown separately when they differ from the source. Confirmed renames retain recorded paths; ambiguous or reused names require correction. Connections do not count as assessment evidence.

## Repositories

Files flagged for possible credential values stay selected and show a warning. Deselect anything you do not want to import. Private keys and known token patterns remain blocked.

Repository imports include reStructuredText documentation, `.conf`, `.cfg` and `.ini` configuration, Windows scripts, and the `mvnw` and `gradlew` build scripts. These are imported as text.

Create or select a repository on the Repositories page, then preview a ZIP of its contents. Paths are relative to the archive root; enclosing folders are kept. Reuse the same repository when reimporting. Review the file list and text, deselect anything unwanted, then accept the selected files. Confirm renames by selecting the existing saved file; equal text alone does not establish identity. Missing files remain saved.

Java, TypeScript, JavaScript, Python, SQL, YAML, JSON, Markdown, and other common text formats are supported. Environment files, keys, Git internals, dependencies, and common generated outputs are excluded. Local pattern checks block apparent private keys and known tokens and flag credential-like values for review. These checks are not exhaustive, can flag examples, and do not replace inspecting or sanitizing the files yourself.

The same ZIP/text size limits listed above apply. Saved files open in the source reader with the repository name, path, revision, and line context. Code is never executed or sent automatically to an AI service. Imports do not create curriculum topics, infer concept-to-code links, or award mastery. Folder selection and public GitHub URL ingestion are not implemented.

## Library

Library lists the imported collections in your account with their short reading references. Importing material does not demonstrate understanding of it.

Select a collection to see its saved items. Each item opens its current saved revision in the source reader, with the import path and original text. Editable notes remain separate from the imported text.

Folder maps group saved items into pages of at most 4,000 characters. Follow the folder and next-page links to browse large collections. Long navigation labels may be shortened; the source reader retains the full path and text. Maps describe saved items, not verified completeness of the original collection.

Repository source readers include a syntax outline for supported text formats. These pattern-based hints can miss declarations and are limited to 30 lines of 240 characters each. They do not infer concepts or verify correctness. Full source text remains available.

## Conversations

On Conversations, choose ChatGPT or Claude, then select a conversations JSON export of at most 100 MiB and preview it in the browser. Previewing does not upload the conversation text. The selected branch retains visible user and assistant messages; hidden reasoning, tool output and other branches are excluded. Missing branch nodes and cycles are reported instead of guessed. Attachments are marked but not analyzed.

Claude exports without parent metadata retain their supplied message order and report that branch metadata is unavailable. Parent-linked exports must form one unambiguous chain. Mixed content blocks retain visible text without also copying duplicate legacy text.

Long conversations use reading pages split before a new user turn after roughly 20,000 characters. A large turn can exceed that size. Pages retain the complete text and never split a message; selecting another conversation starts at its first page.

Select multiple JSON export files together when an export is split into shards, within 100 MiB combined. Identical copies are counted once. Conflicting versions of the same conversation are rejected rather than merged; select one version to resolve the conflict.

Recognizable tokens and private keys are removed from the derived preview. Other credential-like values remain with warnings; these checks can miss secrets or flag examples. Original exports are unchanged. Code and mathematics are retained as text, not executed or checked for correctness.

Create or select a saved conversation source matching the export format, then preview and save. Reuse that source for later imports. The preview shows new, updated and unchanged conversations. Provider IDs keep conversations separate; titles and matching text do not establish identity. Changed text creates a revision, and missing conversations remain saved. If saved data changes after preview, preview again before retrying.

Saving accepts 1–2,000 conversations within 35 MiB of prepared JSON and 500,000 characters per conversation. Text is rejected rather than shortened when it exceeds the limit. Library shows the saved text separately from editable notes and assessments.

Previews show source-reported dates. Saved conversation readers also show the accepted import, visible message count and recorded omissions. Unchanged text uses the newest accepted import metadata for that revision. Older imports without metadata are labelled as unavailable. These dates and counts do not verify correctness, completeness or mastery.

Obsidian previews recognize ChatBridge frontmatter when its conversation URL and UUID agree. Matching saved chats link to their current source revision; multiple copies remain listed. This matches identity, not identical text or branches. Generated `AI Chats/` files remain outside note imports, while annotated notes elsewhere are preserved.

## Library snapshots

In Library, select collections and choose **Save Library snapshot**. The saved page links to the selected source revisions and records their paths, hashes, maps and accepted conversation context. Reimporting a source does not update an existing snapshot. Repeating the same selection without changes reuses its reference.

Snapshots contain saved imports, which may omit parts of the original collections. Preparing a snapshot does not send it to an AI service. Selected source text is limited to 35 MiB; larger libraries need separate selections.

New snapshots contain a compact Library card with source counts and navigation hints from chat titles, file extensions and note folders. These hints are not extracted concepts or prerequisites. **Include learning history** is unchecked by default. Selecting it adds account-wide saved course titles and recent reviewed assessment summaries; the snapshot page shows the card before download.

From the saved page, download `study-library.md` and upload it to a ChatGPT Project. The same file includes authoring instructions, maps, exact source text and saved conversation context. Ask ChatGPT to follow those instructions for your learning request. It should inspect relevant items itself, use general knowledge where needed and name anything it cannot retrieve.

If you have not chosen a subject, open **Find learning directions** on the snapshot page and copy its request into ChatGPT. It asks for five source-backed suggestions and a starting point, without starting a course or lesson. Subjects outside the Library remain available.

Larger libraries download as `study-library.zip`. Extract it and upload every included Markdown file to the same Project. The core file holds instructions, maps and an item-to-file index. Data files keep whole source items together. Each Markdown file is limited to 1,500,000 UTF-8 bytes; this is a packaging budget, not a measured model token limit. An item or index that cannot fit is reported without shortening it. Check the displayed file count against your account allowance.

The instructions request a complete course outline as downloadable JSON, with a JSON block as fallback. ChatGPT Web still requires manual file upload and response transfer. Study Tool does not automate its website or require a paid AI API. Upload limits and reading behavior depend on the account and model; including text does not prove ChatGPT read it.

The download page flags uncertain credential values without removing them. Known token/private-key patterns block the download. These checks do not identify all private information; review the selected material before sharing it.

## Import ChatGPT responses

Inbox accepts one complete JSON object or a response containing course, module, digest and assessment code blocks. Paste up to 20 blocks within 1 MiB. It validates the full batch before saving it in one database transaction. An invalid block leaves the batch unchanged. Repeated imports retain existing records and assessment decisions; new assessments start pending review. Unrelated JSON blocks are counted and ignored.

Use **Import ChatGPT file** in Inbox or Courses to choose a downloaded `.json`, `.txt` or `.md` response. Selection starts validation and saving without another submit button. Files containing a course or module open that course automatically. For pasted responses, Inbox shows the saved results; Courses opens the course. Paste remains available when ChatGPT cannot create a file.

## Source summaries

ChatGPT can return a `study-digest/1` block for source items it opened. Import it under **Import source summaries** on the matching snapshot page. Each entry has an item ID and a one-line summary of at most 200 characters. Saved summaries appear beside Library items only while the revision, path and conversation context match. Corrections append a version; retrying an old summary does not replace a newer correction. Summaries remain unverified navigation aids. Original text and saved snapshots stay unchanged.

New snapshots include matching summaries in their navigation maps. The snapshot records the exact summary versions; later corrections do not change an existing download. Full source text remains included. Summaries help ChatGPT choose items to inspect but do not prove their contents are correct.

## Courses

Ask ChatGPT for a course using your uploaded Library, then import the returned file in **Courses**. The app detects its export reference and requires that snapshot in your account. It checks module prerequisites, item references, exclusions and required fields before saving. Reimporting an unchanged outline opens the same course.

Courses show the outline, independent proofs, source accounting, exclusions and open questions. Unassigned sources are reported rather than treated as covered. These checks validate structure and references; they do not verify explanations, lesson quality or mastery.

Open a module's lesson plan and copy its request into the ChatGPT Project containing that Library version. Paste the returned `study-module/1` JSON into the module's import form. The app checks the course, export, module, ordered step IDs and source references. Saved plans retain their lesson identities on repeat import. A different plan for the same module is rejected rather than replacing existing lessons.

Select a saved lesson to copy its study request. It includes the lesson's goal, source references, completion condition and saved identities. ChatGPT teaches that step using relevant Library material and general knowledge. Copying the request does not record completion or mastery.

Use **Mark done** after studying a lesson, or **Reopen** to clear that mark. This records study activity only; approved assessments still determine mastery. Reimporting the same lesson plan retains these marks.

The course's continuation button opens the first unfinished lesson in outline order. Marking a lesson done moves there automatically. If the next module has no saved plan, the app opens its planning request first. Reopening a lesson keeps that lesson selected.

## Assessments

At the end of a tutoring session, get a `study-evidence` receipt using the format in the assessment page. Paste or import the receipt, review the original work, and approve or reject it. Only approved receipts affect the current mastery level and review schedule. A topic with no approved assessment remains **Not assessed**, not level 0.

Saved lesson requests supply a persistent `step` UUID and matching `course-step:<UUID>` topic for receipts. The app accepts only lesson IDs in your account and shows their goals during review. Repeat imports keep the existing receipt and review decision. Existing note-topic receipts remain supported. A receipt reports demonstrated work; importing it does not independently verify that work.

Each saved lesson shows its latest approved assessment and review date, or **Not assessed**. The copied study request includes that assessment's task, evidence, hints and remaining practice. Pending and rejected receipts do not affect this display. A later approved assessment can lower the score.

Levels run from 0 (unfamiliar) to 5 (able to transfer the skill to a new problem). Level 3 or higher requires independent work. An assessment can lower an earlier score; the most recent approved assessment is used.

## Tutor modes

The ChatGPT Web and Codex buttons copy a prepared study prompt and open the corresponding official site. They are handoffs, not an embedded AI API. Study Tool does not ask for ChatGPT login credentials or make AI API calls.

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The database schema is under `supabase/`, page routes and server actions under `src/app/`, and the curriculum, note, and assessment logic under `src/lib/`.

## License

MIT. See [LICENSE](LICENSE).
