import Link from "next/link";

export default function HowToUsePage() {
  return <>
    <div className="page-heading"><h1>How to use</h1><p>Study Tool organizes your material and tracks progress. ChatGPT creates the course and teaches you.</p></div>
    <section className="panel usage-guide" aria-label="From imports to studying">
      <ol>
        <li><h2>Import your material</h2>
          <p>Use any of these sources. You do not need all three.</p>
          <ul>
            <li><Link href="/conversations">Conversations</Link>: choose ChatGPT or Claude, create a named collection, select your JSON export, review it, then save.</li>
            <li><Link href="/notes">Notes</Link>: create or select a vault, click <strong>Import Obsidian notes</strong>, select Markdown files or a vault ZIP, review, then save.</li>
            <li><Link href="/repositories">Repositories</Link>: list a public GitHub profile and choose repositories, or import one repository URL or ZIP. Review and save the files.</li>
          </ul>
        </li>
        <li><h2>Save a Library snapshot</h2>
          <p>Open <Link href="/library#library-snapshot">Library</Link>, select the collections to include, then click <strong>Save snapshot and open export</strong>.</p>
        </li>
        <li><h2>Send your Library to ChatGPT</h2>
          <p>In <Link href="/library#library-downloads">Library downloads</Link>, click <strong>Download Study Library</strong>. Upload the downloaded Markdown file to your <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT Project</a>. For a ZIP, extract it and upload all its Markdown files.</p>
          <p>The export includes the instructions ChatGPT needs. Upload it once per snapshot.</p>
        </li>
        <li><h2>Ask for a course</h2>
          <p>In the same ChatGPT Project, say what you want to learn. For example:</p>
          <blockquote>Create a beginner course for rebuilding my repository independently. Follow the Study Library instructions and return the outline and first lesson plan in one JSON file.</blockquote>
          <p>You can request any subject. ChatGPT uses Library examples when they fit your goal.</p>
        </li>
        <li><h2>Bring the course back to Study Tool</h2>
          <p>Upload the single JSON file from ChatGPT in <Link href="/inbox">Inbox</Link>, or paste the response. Study Tool saves the full roadmap and the first module&apos;s lesson plan together, then opens the first unfinished lesson.</p>
        </li>
        <li><h2>Study in the same chat</h2>
          <p>Say <strong>start</strong> in the ChatGPT chat that created your course. Ask for the next lesson there when ready.</p>
          <p>In <Link href="/courses">Courses</Link>, click <strong>Mark done</strong>, then <strong>Go to next lesson</strong> when you are ready. <Link href="/dashboard">Dashboard</Link> shows your saved place. When you reach modules that need plans, use <strong>Prepare several lesson plans</strong> to request them together and import the response in one batch.</p>
          <p>On <Link href="/dashboard">Dashboard</Link>, use <strong>Switch course</strong> to change roadmaps or <strong>Manage course</strong> to rename or delete the current one. Import another course to keep studying both.</p>
          <p>If ChatGPT returns an assessment receipt, import it through <Link href="/inbox">Inbox</Link> and review it in <Link href="/assessments">Assessments</Link>. Finishing a lesson and demonstrating a skill are recorded separately.</p>
        </li>
      </ol>
      <p>Added or changed your imports? Save and download a new <Link href="/library#library-snapshot">Library snapshot</Link> and upload its files to ChatGPT. Existing snapshots keep their original source versions.</p>
    </section>
  </>;
}
