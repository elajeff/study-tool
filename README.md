# Study Tool

Study Tool turns Markdown notes into a study roadmap. It supports Obsidian vault imports, practice topics, reviewed assessments, and handoffs to ChatGPT Web or Codex.

The roadmap follows the material each person imports. No standard course is assigned to every account.

## Features

- Email sign-in and private workspaces using Supabase Auth and row-level security.
- Markdown import, editing, and export.
- Study topics and prerequisite links drawn from source notes.
- Progress and review reminders based on approved assessments.
- ChatGPT Web as the default tutor, with an optional Codex handoff. Both open in their official sites.

## Setup

Requires Node.js 22.13 or newer within the Node 22 release line, or Node.js 24+, and a Supabase project. The baseline is verified with Node.js 24.22.0 and npm 11.19.1. The committed lockfile records the resolved dependency versions.

1. Run `npm ci` to install the locked dependencies.
2. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable/anon key. Do not use the service-role key.
3. Set up the database in the Supabase SQL Editor:
   - **Fresh installation:** run `supabase/schema.sql`, then `supabase/002_assessments.sql`, in that order. Both files are required.
   - **Upgrade from v0.1:** run only `supabase/002_assessments.sql` against the existing database before using v0.2. Do not rerun `schema.sql`; it creates tables and policies that already exist.
   - **Existing v0.2 database:** if the assessment migration has already been applied, do not rerun it. Its policy creation is not idempotent.

   The assessment migration retains existing notes, profiles, and legacy progress. Legacy self-ratings no longer determine mastery; approved assessment receipts do.
4. Enable email sign-in in Supabase Authentication. Set the Site URL to `http://localhost:3000` for development and allow `http://localhost:3000/auth/confirm` as a redirect.
5. For the magic-link PKCE callback, use this link in the Supabase email template:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to Study Tool</a>
   ```

6. Run `npm run dev` and open `http://localhost:3000`.

For deployment, configure the production site URL and redirect URL in Supabase, and set the same public environment variables on the Next.js host. Configure production SMTP, backups, rate limits, and a privacy notice before opening registration.

## Obsidian

Import `.md` files or a ZIP containing Markdown. The app uses these folders when present:

- `Lessons/Java/`, `DSA/`, and `Foundations/` for the main study tracks.
- `Concepts/` for technical reference topics.
- `Learning Projects/` for project practice.
- `Walkthroughs/` for implementation traces.

Other Markdown collections can be used too. Obsidian configuration, chat archives, and generated progress reports are skipped during import. Prerequisites are read from explicitly named sections, not from every wikilink.

Import and export are manual; this version does not synchronize with the local Obsidian directory or read ChatGPT conversations automatically.

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
