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
          <p>Upload the single JSON file from ChatGPT in <Link href="/inbox">Inbox</Link>. Study Tool saves the full roadmap and the first module&apos;s lesson plan together, then opens the first unfinished lesson. If ChatGPT only gives you a code block, use the paste option in Inbox.</p>
        </li>
        <li><h2>Study in the same chat</h2>
          <p>Open a lesson from the roadmap. On the lesson page, open your course chat and say <strong>start</strong> for the first lesson. ChatGPT explains the topic, works through an example, then gives you a fresh exercise. Solve it yourself and share your attempt in the same chat for feedback.</p>
          <p>Check <strong>After studying</strong> on the lesson page to see what you should be able to do. Click <strong>Mark done</strong> when you can do it. When <strong>Go to next lesson</strong> appears, open it and ask ChatGPT to continue at the lesson ID shown. Use <strong>Back to roadmap</strong> to see the whole course. <Link href="/dashboard">Dashboard</Link> shows your saved place.</p>
          <p>On <Link href="/dashboard">Dashboard</Link>, use <strong>Switch course</strong> to change roadmaps or <strong>Manage course</strong> to rename or delete the current one. Import another course to keep studying both.</p>
        </li>
        <li><h2>Prepare more lessons when needed</h2>
          <p>A module is a section of your roadmap. Its lesson plan breaks it into individual lessons. The first plan comes with the course.</p>
          <p>When you see <strong>Prepare the next lesson plan</strong> or a module marked <strong>Needs a lesson plan</strong>, copy that module&apos;s request into your course chat. Import the file ChatGPT returns. To plan ahead, use <Link href="/courses#batch-plans">Plan several modules at once</Link> when two or more modules still need lessons.</p>
        </li>
      </ol>
      <p>Added or changed your imports? Save and download a new <Link href="/library#library-snapshot">Library snapshot</Link> and upload its files to ChatGPT. Existing snapshots keep their original source versions.</p>
    </section>
  </>;
}
