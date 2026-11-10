# Architecture

Study Tool is a Next.js application backed by Supabase. Each account has its own profile, imported notes, and assessment receipts. Supabase Auth handles sign-in; row-level security limits database access to the owning account.

## Data

- `study_profiles` stores learning goals and starting knowledge.
- `notes` stores Markdown files and their original vault paths.
- `lesson_progress` stores legacy v0.1 self-ratings. It is retained during the upgrade but no longer determines mastery.
- `assessment_receipts` stores pending, approved, and rejected evidence. The current score for a topic comes from its most recent approved receipt.

The curriculum is computed from notes rather than stored separately. Identifiers depend on the original path, so edits do not reset progress. Renaming a note changes that identifier.

## Tutor handoff

The browser copies context when someone opens ChatGPT Web or Codex. Neither service is embedded and neither shares its conversation history with Study Tool.

## Import boundaries

Imported Markdown is treated as data, not instructions. Files from `.obsidian/`, chat archives, and generated progress folders are skipped. Raw HTML in Markdown is not executed. Imports and exported notes are scoped to the signed-in user.

## Known limits

There is no live Obsidian sync or automated model grading. Evidence is reviewed by the account owner. External AI models and hosted authentication would need their own supported integration and permission checks.
