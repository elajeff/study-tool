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
        <li><h2>Download and upload to ChatGPT</h2>
          <p>In <Link href="/library#library-downloads">Library downloads</Link>, click <strong>Download Study Library</strong>. Upload the downloaded Markdown file to your <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT Project</a>. For a ZIP, extract it and upload all its Markdown files.</p>
          <p>The files include instructions for ChatGPT. Study Tool does not upload them for you.</p>
        </li>
        <li><h2>Ask for a course</h2>
          <p>In that ChatGPT Project, say what you want to learn. For example:</p>
          <blockquote>Create a beginner course for rebuilding my repository independently. Follow the Study Library instructions and return the course JSON for Study Tool.</blockquote>
          <p>You can request any subject, even one outside your Library. ChatGPT uses your material where relevant.</p>
        </li>
        <li><h2>Import the course</h2>
          <p>Open <Link href="/inbox">Inbox</Link> and choose ChatGPT&apos;s JSON file; it is checked and saved automatically. Or paste the response and click <strong>Import response</strong>. Open the saved outline in <Link href="/courses">Courses</Link>.</p>
        </li>
        <li><h2>Prepare a module and study</h2>
          <p>In <Link href="/courses">Courses</Link>, choose a module. Copy its lesson-plan request into ChatGPT, then import the returned JSON using <strong>Import a plan</strong> in that module.</p>
          <p>Choose a lesson, copy its study request into the same ChatGPT Project, and work through the explanation and exercises there.</p>
        </li>
        <li><h2>Record progress and continue</h2>
          <p>Return to <Link href="/courses">Courses</Link> and mark completed lessons done. Study Tool cannot see your ChatGPT activity automatically.</p>
          <p>If ChatGPT returns an assessment receipt, import it through <Link href="/inbox">Inbox</Link> and review it in <Link href="/assessments">Assessments</Link>. Finishing a lesson and demonstrating a skill are recorded separately.</p>
        </li>
      </ol>
      <p>Added or changed your imports? Save and download a new <Link href="/library#library-snapshot">Library snapshot</Link> and upload its files to ChatGPT. Existing snapshots keep their original source versions.</p>
    </section>
  </>;
}
