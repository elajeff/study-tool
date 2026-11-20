# Study Tool

A study app that uses your notes, code and past AI conversations as material for learning. Ask to learn a repository, work through a portfolio or study a new subject, then keep the course and your place in it here.

Built with Next.js, TypeScript and Supabase. The app organizes imports into a saved Library; you upload its files to ChatGPT, which writes the course and teaches the lessons. Returned JSON files bring the outline, lesson plans and assessment records back into the app. No paid AI API or local model download is required.

## What it does

Try the [demo course](https://study-tool-opal.vercel.app/demo) without signing in.

- Imports Obsidian Markdown, repository ZIPs, public GitHub snapshots and exported ChatGPT or Claude conversations.
- Keeps imported source text separate from editable notes, with saved revisions and reading references.
- Packages selected material with maps and course-writing instructions for ChatGPT. Related material can supply familiar examples; subjects outside the Library are still available.
- Imports course outlines and module plans, shows numbered lesson cards and continues at the next unfinished lesson.
- Prepares separate repository course requests and a request to combine them into one learning journey.
- Records Done/Reopen activity separately from reviewed assessments of independent work.

## Running it

You need Node.js 24+ (or Node.js 22.13+ within the Node 22 release line) and a Supabase project.

1. Run `npm ci` to install the locked dependencies.
2. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable/anon key. Do not use the service-role key.
3. Set up the database in the Supabase SQL Editor:
   - **Fresh installation:** run `supabase/schema.sql`, then all numbered SQL migrations in `supabase/` in order.
   - **Existing database:** apply any missing numbered migrations in order. Run `schema.sql` only for a fresh database.
   - Apply each file once. They create tables or policies that already exist if rerun.

   The migrations retain existing notes, profiles, progress, and assessment receipts. Existing assessment topic keys are kept when notes are linked to source artifacts. Legacy self-ratings no longer determine mastery; approved assessment receipts do.
4. Enable email sign-in in Supabase Authentication. Set the Site URL to `http://localhost:3000` for development and allow `http://localhost:3000/auth/confirm` as a redirect.
5. For the email sign-in callback, use this link in the Supabase email template:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to Study Tool</a>
   ```

6. Run `npm run dev` and open `http://localhost:3000`.

For deployment, configure the production site URL and redirect URL in Supabase, and set the same public environment variables on the Next.js host. Follow the [hosted signup checks](docs/ARCHITECTURE.md#hosted-signup) before inviting users.

## Using it

1. Sign in and import material through **Notes**, **Repositories** or **Conversations**. Review the preview before saving.
2. In **Library**, select the collections to include and choose **Save Library snapshot**.
3. Download the Study Library and upload it to a ChatGPT Project. For a ZIP, extract it and upload all included Markdown files. The authoring instructions are included.
4. Ask ChatGPT for a course, then choose its returned JSON file in **Courses**. The app checks the source references and outline structure before saving.
5. Open a module, copy its lesson-plan request into ChatGPT and import the returned plan beside that request.
6. Select a lesson and copy its study request into ChatGPT. Mark it done after studying; review assessment receipts separately before they count toward mastery.

Reusing the same import collection preserves source identities. Existing Library snapshots keep their original revisions. [The usage guide](docs/USAGE.md) covers reimports, file limits, source summaries, portfolio requests and assessments.

## Tests

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The unit tests cover import parsing, source identities, Library packaging, response validation, course continuation and assessment rules. They use fixtures and simulated network responses; they do not call an AI provider or prove teaching quality. GitHub Actions runs these commands on pull requests and pushes to main.

Database ownership and transaction checks are separate SQL scripts under `supabase/tests/`. Run them against a disposable database after applying the schema and migrations; see [database checks](docs/ARCHITECTURE.md#database-checks).

## Project layout

| Path | Contents |
| --- | --- |
| `src/app/` | Pages, authenticated server actions and the public GitHub download endpoint |
| `src/components/` | Import previews, note editor, course cards and tutor handoffs |
| `src/lib/` | Import readers, Library packaging, response validation and progress rules |
| `supabase/` | Database schema, ordered migrations and SQL integration checks |
| `tests/` | Unit tests |
| `docs/` | [Architecture](docs/ARCHITECTURE.md) and [usage guide](docs/USAGE.md) |

## Data and privacy

Account data is stored in the configured Supabase project, with row-level security restricting access to its owner. This is not a local-only app. Original import files and Obsidian vaults are not rewritten.

Previewing files happens in the browser. Accepting an import saves its prepared text to Supabase. Downloading a Library does not send it to ChatGPT; uploading it there is a separate manual step. Known token and private-key patterns are blocked or redacted, while uncertain credential-like values stay visible with warnings. These checks can miss secrets, so review material before sharing it.

## Limitations

- ChatGPT uploads and response imports are manual. The app does not automate ChatGPT Web or receive its conversation history automatically.
- Valid references and a complete-looking outline do not prove correct explanations or curriculum coverage. ChatGPT can miss uploaded material or make mistakes.
- Done means studied, not mastered. Assessment receipts need owner review and are not independently graded by the app.
- Import and upload budgets are bounded. Large collections may need separate selections, and ChatGPT's own file allowances still apply.
- There is no live Obsidian sync. Imported code is read as text and never executed.

## License

MIT. See [LICENSE](LICENSE).
