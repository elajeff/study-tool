# Study Tool

Study Tool organizes personal Markdown notes into a study roadmap. It supports Obsidian imports, practice topics, progress tracking, and handoffs to ChatGPT Web or Codex.

## Features

- Email sign-in and private user workspaces through Supabase.
- A roadmap derived from imported notes and learning goals.
- Markdown import, editing, and export.
- Self-reported lesson progress and scheduled review reminders.
- ChatGPT Web as the default tutor, with an optional Codex handoff. Both open in their official sites.

## Setup

Requires Node.js 22+ and a Supabase project.

1. Run `npm install`.
2. Copy `.env.example` to `.env.local`. Enter the Supabase project URL and publishable/anon key. Never use the service-role key in this app.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. Enable email sign-in in Supabase Authentication. For development set the Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/confirm` as a redirect.
5. Configure the email magic-link template for the PKCE callback:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in to Study Tool</a>
   ```

6. Run `npm run dev` and open `http://localhost:3000`.

For deployment, configure the production site URL, allowed redirect URLs, and the same public environment variables on the Next.js host. Set up production SMTP, backups, rate limits and a privacy notice before opening registration.

## Using the app

Set your goals and experience, then import `.md` files or a ZIP of Markdown notes. Topics come from `Concepts/` if that folder exists, or from ordinary notes otherwise. Links from named prerequisite sections are used to order study topics. The roadmap does not write complete lessons automatically.

Open a topic to see its source note and exercise. Select ChatGPT Web or Codex to copy study context and open the official site. You can record lesson progress back in Study Tool afterward.

Import and export are manual. The app does not read a local vault directly or synchronize ChatGPT conversations.

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

App routes and server actions are in `src/app/`; curriculum and note logic is in `src/lib/`; the database schema is under `supabase/`.

## License

MIT. See [LICENSE](LICENSE).
