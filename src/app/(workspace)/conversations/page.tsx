import { requireAccount } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ConversationPreview } from "@/components/ConversationPreview";
import { loadLibrarySources } from "@/lib/library-queries";

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const { supabase } = await requireAccount();
  const sources = (await loadLibrarySources(supabase)).filter(source => source.kind === "chatgpt" || source.kind === "claude");
  const query = await searchParams;
  const selected = query.source ? sources.find(source => source.id === query.source) : sources[0];
  if (query.source && !selected) notFound();
  return <>
    <div className="page-heading"><h1>Conversations</h1><p>Read visible conversations from a ChatGPT or Claude JSON export. Imported discussions are reference material, not proof of knowledge.</p></div>
    <ConversationPreview key={selected?.id ?? "new"} sources={sources} sourceId={selected?.id ?? ""} />
  </>;
}
