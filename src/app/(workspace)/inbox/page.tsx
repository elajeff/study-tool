import { InboxImporter } from "@/components/InboxImporter";

export default function InboxPage() {
  return <><div className="page-heading"><h1>Inbox</h1><p>Import course outlines, modules, item summaries and assessment receipts from ChatGPT.</p></div>
    <section className="panel"><p>All recognized blocks must validate before anything is saved. Assessments start pending review and do not grant mastery automatically.</p>
      <InboxImporter />
    </section></>;
}
