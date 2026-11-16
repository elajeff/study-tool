import { requireAccount } from "@/lib/auth";
import { ConversationPreview } from "@/components/ConversationPreview";

export default async function ConversationsPage() {
  await requireAccount();
  return <>
    <div className="page-heading"><h1>Conversations</h1>
      <p>Read visible conversations from a ChatGPT or Claude JSON export. Discussions are reference material, not proof of knowledge.</p></div>
    <ConversationPreview />
  </>;
}
