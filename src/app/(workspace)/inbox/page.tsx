import { InboxImporter } from "@/components/InboxImporter";

export default function InboxPage() {
  return <><div className="page-heading"><h1>Inbox</h1><p>Import a course and its first lesson plan from ChatGPT. You can also import additional plans, source summaries and assessment receipts here.</p></div>
    <section className="panel"><p>All recognized blocks must validate before anything is saved. Assessments start pending review and do not grant mastery automatically.</p>
      <InboxImporter allowPaste />
    </section></>;
}
