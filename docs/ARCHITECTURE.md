# Architecture

Study Tool runs as a Next.js application with Supabase Auth and a Postgres database. Each account has its own profile, notes, and self-reported progress records. Supabase row-level security restricts database access to the owning user.

The roadmap is computed from imported Markdown and the user's profile. Prerequisite links come from specific note sections. Topic IDs are based on source paths, so editing note content does not reset progress. Renaming a note changes its ID.

ChatGPT Web and Codex open in separate tabs. The user decides when to copy the prepared context; the app does not access those conversations.

Imports are size-limited and paths are checked for traversal or hidden files. Markdown is displayed without enabling raw HTML. The application uses public Supabase keys and the signed-in account, not a service-role key.

There is no live Obsidian sync, automated grading, or embedded AI chat in this version.
