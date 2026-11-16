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
   - **Fresh installation:** run `supabase/schema.sql`, then numbered migrations `002` through `007` from `supabase/`, in order.
   - **Upgrade from v0.1:** run numbered migrations `002` through `007` against the existing database. Do not rerun `schema.sql`; it creates tables and policies that already exist.
   - **Existing v0.2 database:** apply any missing numbered migrations in order. A database with `006` already applied needs only `007`.
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

## Assessments

At the end of a tutoring session, get a `study-evidence` receipt using the format in the assessment page. Paste or import the receipt, review the original work, and approve or reject it. Only approved receipts affect the current mastery level and review schedule. A topic with no approved assessment remains **Not assessed**, not level 0.

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
