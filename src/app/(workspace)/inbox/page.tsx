import { InboxImporter } from "@/components/InboxImporter";

export default function InboxPage() {
  return <><div className="page-heading"><h1>Inbox</h1><p>Import a course and its first lesson plan from ChatGPT. You can also import additional lesson plans and source summaries here.</p></div>
    <section className="panel"><p>All recognized blocks must validate before anything is saved.</p>
      <InboxImporter allowPaste />
    </section></>;
}
