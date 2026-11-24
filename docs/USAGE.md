# Using Study Tool

Detailed import rules, file limits and course handoffs. For installation, see the [README](../README.md).

## Dashboard

Dashboard follows the course selected in the current browser session, or the newest saved course. It shows module and lesson completion, estimated time remaining, and a link to the next lesson or module plan. Marking a lesson done records activity, not mastery.

Time remaining uses unfinished planned lessons plus the outline's lesson-count estimates for unplanned modules. The default assumption is 30 minutes per lesson and the weekly hours in Settings. On Dashboard, save hours per study day, study days per week and minutes per lesson to override those defaults for this account in this browser. The preference persists across visits. Calendar days spread the weekly budget evenly; study days use your daily hours. These are planning estimates, not measured durations or guaranteed deadlines.

The separate note-based roadmap is available through **Browse note topics** on Notes. Imported ChatGPT courses do not change that view.

## Obsidian

Create or select a vault on the Notes page, then preview `.md` files or a ZIP containing Markdown. Reuse that vault when reimporting; its UUID identifies the collection independently of its name. Different vaults can contain the same path. Note topics are grouped by vault and top-level folder. Explicit prerequisite links determine the order within each group.

ZIPs with a single `.obsidian` directory use its parent as the vault root. ZIPs without it keep their relative paths. A path change on reimport can be reconciled in the rename picker. Obsidian metadata and files under ChatBridge's `AI Chats/` folder are skipped.

The preview compares incoming files with the current editable notes and the last accepted import. Local edits are kept when the source is unchanged. Conflicting changes require a choice. For a rename, select the existing artifact; matching text alone never merges files. Files absent from the selection are kept.

Legacy migration snapshots have no trusted import baseline. If their current text differs from an incoming file, review both versions and choose which editable text to keep.

Imports accept at most 2,000 notes, 500,000 UTF-8 bytes per file, a 20 MiB ZIP, and 35 MiB of JSON per batch. Oversized or excluded files are counted in the preview. Exporting a selected vault keeps its paths; exporting all notes uses separate folders by vault ID to prevent collisions. Manual notes can also be exported separately.

Import and export are manual. Nothing is written to the original vault, and there is no live sync or automatic ChatGPT conversation import.

The note editor shows explicit links, prerequisites, and recommendations. Source citations open the saved revision at the relevant line. Local edits are shown separately when they differ from the source. Confirmed renames retain recorded paths; ambiguous or reused names require correction.

## Repositories

For a course about each repository, open Portfolio from Courses or a saved Library snapshot. Copy a repository request into the ChatGPT Project containing that snapshot, then import the returned course through Inbox. Each request keeps its repository scope and exact Library version.

For a journey across repositories, include them in one snapshot and import a course draft for each. Portfolio lets you select one course per repository and copy a request to combine them. Every selected course must use the same snapshot. ChatGPT reviews the proposed capabilities and shared foundations; the app checks references and structure, not curriculum completeness.

To import a GitHub profile, enter its URL under **Import from a GitHub profile** and click **List repositories**. Select individual repositories or use **Select all** and **Clear selection**, then click **Review selected repositories**. The app downloads one repository at a time from its default branch. Review its files and save to continue, or skip it. Each repository has its own collection. Previous GitHub imports reuse their saved collection; new collections are created when you save. Stopping the queue keeps repositories already saved. Reloading the page discards the remaining queue.

For a single repository, create or select a collection, then preview a ZIP or enter a public GitHub repository URL. You can choose a branch, tag or commit; leaving it blank uses the default branch. URL previews resolve a fixed commit before downloading, then use the same file review and import checks as ZIPs. GitHub's archive wrapper is removed; local ZIP paths stay as stored. Private repositories require a local ZIP. No GitHub token is required, and public request limits can require waiting or using ZIP instead.

Files flagged for possible credential values stay selected and show a warning. Deselect anything you do not want to import. Private keys and known token patterns remain blocked.

Repository imports include reStructuredText documentation, `.conf`, `.cfg` and `.ini` configuration, Windows scripts, and the `mvnw` and `gradlew` build scripts. These are imported as text.

New repository imports record skipped and deselected paths. ZIP imports leave the original commit unknown. Library snapshots record the import in which each revision was first saved, including its available origin and exclusions. Unchanged reimports do not relabel old text as a newer checkout. A collection may span imports; it is not a verified current repository checkout. Older imports without this metadata remain unknown.

Reuse the same repository when reimporting. Review the file list and text, deselect anything unwanted, then accept the selected files. Confirm renames by selecting the existing saved file; equal text alone does not establish identity. Missing files remain saved.

Java, TypeScript, JavaScript, Python, SQL, YAML, JSON, Markdown, and other common text formats are supported. Environment files, keys, Git internals, dependencies, and common generated outputs are excluded. Local pattern checks block apparent private keys and known tokens and flag credential-like values for review. These checks are not exhaustive, can flag examples, and do not replace inspecting or sanitizing the files yourself.

The same ZIP/text size limits listed above apply. Saved files open in the source reader with the repository name, path, revision, and line context. Code is never executed or sent automatically to an AI service. Imports do not create curriculum topics, infer concept-to-code links, or award mastery. Folder selection is not implemented.

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

Saving accepts 1–2,000 conversations within 35 MiB of prepared JSON and 500,000 characters per conversation. Text is rejected rather than shortened when it exceeds the limit. Library shows the saved text separately from editable notes.

Previews show source-reported dates. Saved conversation readers also show the accepted import, visible message count and recorded omissions. Unchanged text uses the newest accepted import metadata for that revision. Older imports without metadata are labelled as unavailable. These dates and counts do not verify correctness, completeness or mastery.

Obsidian previews recognize ChatBridge frontmatter when its conversation URL and UUID agree. Matching saved chats link to their current source revision; multiple copies remain listed. This matches identity, not identical text or branches. Generated `AI Chats/` files remain outside note imports, while annotated notes elsewhere are preserved.

## Library snapshots

In Library, select collections and choose **Save snapshot and open export**. Open a collection to exclude individual items from future snapshots. A repository with recorded import history contributes the files accepted in its latest recorded batch. The download lists how many paths were excluded from a repository import. Review the exact items on the saved page before downloading. New imports and selection changes leave existing snapshots intact.

Snapshots contain saved imports, which may omit parts of the original collections. Preparing a snapshot does not send it to an AI service. Selected source text is limited to 35 MiB; larger libraries need separate selections.

To remove a collection, open it in Library and choose **Remove collection**. The confirmation lists the snapshots that will be removed with it. Courses based on those snapshots, their lesson plans and progress are deleted too. Remove files you downloaded or uploaded to ChatGPT separately.

New snapshots contain a compact Library card with source counts and navigation hints from chat titles, file extensions and note folders. These hints are not extracted concepts or prerequisites. **Include learning history** is unchecked by default. Selecting it adds recent saved course titles; the snapshot page shows the card before download.

From the saved page, download `study-library.md` and upload it to a ChatGPT Project. The same file includes authoring instructions, maps, exact source text and saved conversation context. Ask ChatGPT to follow those instructions for your learning request. It should inspect relevant items itself, use general knowledge where needed and name anything it cannot retrieve.

If you have not chosen a subject, open **Find learning directions** on the snapshot page and copy its request into ChatGPT. It asks for five source-backed suggestions and a starting point, without starting a course or lesson. Subjects outside the Library remain available.

Larger libraries download as `study-library.zip`. Extract it and upload every included Markdown file to the same Project. The core file holds instructions, maps and an item-to-file index. Data files keep whole source items together. Each Markdown file is limited to 1,500,000 UTF-8 bytes; this is a packaging budget, not a measured model token limit. An item or index that cannot fit is reported without shortening it. Check the displayed file count against your account allowance.

The instructions request the complete course outline and first module plan in one downloadable JSON file, with a JSON block as fallback. Say **start** in the same conversation to begin studying. Upload limits and reading behavior depend on the ChatGPT account and model. Study Tool requires no paid AI API.

The download page flags uncertain credential values without removing them. Known token/private-key patterns block the download. These checks do not identify all private information; review the selected material before sharing it.

## Import ChatGPT responses

Inbox accepts one complete JSON object or a response containing course, module and digest code blocks. Paste up to 20 blocks within 1 MiB. It validates the full batch before saving it in one database transaction. An invalid block leaves the batch unchanged. Repeated imports keep existing plans and progress. Unrelated JSON blocks are counted and ignored.

Use **Choose file** in Inbox or on a module without a plan to choose a downloaded `.json`, `.txt` or `.md` response. Selection starts validation and saving. A course with its first plan opens the first unfinished lesson whether you choose a file or paste the response. Other pasted responses show the saved results in Inbox.

## Source summaries

ChatGPT can return a `study-digest/1` block for source items it opened. Import it under **Import source summaries** on the matching snapshot page. Each entry has an item ID and a one-line summary of at most 200 characters. Saved summaries appear beside Library items only while the revision, path and conversation context match. Corrections append a version; retrying an old summary does not replace a newer correction. Summaries remain unverified navigation aids. Original text and saved snapshots stay unchanged.

New snapshots include matching summaries in their navigation maps. The snapshot records the exact summary versions; later corrections do not change an existing download. Full source text remains included. Summaries help ChatGPT choose items to inspect but do not prove their contents are correct.

## Courses

Saved courses include an optional outline-review request for ChatGPT. Add your original learning request when needed so the review checks your intended scope. Import a revised outline through Inbox; existing lessons and progress stay with the original course.

Ask ChatGPT for a course using your uploaded Library, then import the returned file in **Inbox**. The app checks the snapshot, module prerequisites, item references and first plan before saving both parts together. It opens the first unfinished lesson of that module. Reimporting the same file keeps the saved lesson IDs and progress. Outline-only files remain supported.

Courses show the outline, independent proofs, source accounting, exclusions and open questions. Unassigned sources are reported rather than treated as covered. These checks validate structure and references; they do not verify explanations, lesson quality or mastery.

The roadmap shows numbered module and lesson cards. **Start lesson** opens a separate page for that lesson. Use **Back to roadmap** or open **Courses** in the sidebar to return. Its progress bar counts saved lesson plans only; modules without a plan are listed separately. A full bar does not mean the entire course is planned or mastered.

For modules without a saved plan, copy the module request into the ChatGPT Project containing that Library version. Import its `study-module/1` file beside the request. If ChatGPT only returns a code block, paste the response in Inbox. The form accepts that module's plan and any summaries for the same export. The app checks the course, export, module, ordered step IDs and source references. Reimports keep saved lesson IDs and progress. Use **Get a saved lesson request** if you switch chats or need to restore the lesson instructions.

For several modules, open **Plan several modules at once** in Courses. Select 2 to 5 unplanned modules and copy the batch request. Import the returned file in the same section. All selected plans must pass validation before any are saved. The results link to each saved plan.

Continue in the ChatGPT conversation that created the course. When you need a saved lesson request, it includes the goal, source references, completion condition and saved identities. ChatGPT explains the topic, works through an example, checks understanding and gives you a fresh exercise. Share your own attempt in that chat and use the feedback to address any gaps.

Check the outcome under **After studying**, then choose **Mark done** once you can do it. Choose **Reopen** if you need to study it again. Reimporting the same lesson plan retains these marks.

After marking a lesson done, click **Go to next lesson** and tell ChatGPT the lesson ID. If the next module needs a plan, the app links to its planning request.

## Tutor modes

The ChatGPT Web and Codex buttons copy a prepared study prompt and open the corresponding official site. They are handoffs, not an embedded AI API. Study Tool does not ask for ChatGPT login credentials or make AI API calls.

