const keyHeader = /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/;
const token = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/;
const connection = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^/\s:@]+:[^@\s]+@/i;
const assignment = /\b(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|secret(?:[_-]?key)?|private[_-]?key|aws_secret_access_key|token)\b["']?\s*[=:]\s*(?:["']([^"'\r\n]+)["']|([A-Za-z0-9_+/.=-]+))/gi;
function concreteValue(quoted: string | undefined, bare: string | undefined) {
  return !(bare && /^(null|undefined|true|false)$/i.test(bare))
    && !/^(\$\{|process\.env\.|os\.environ|os\.getenv|System\.getenv)/.test(quoted ?? bare ?? "");
}

export function inspectImportText(body: string): { blocked: string | null; review: string | null } {
  if (keyHeader.test(body)) return { blocked: "Possible private key. Remove it locally before importing.", review: null };
  if (token.test(body)) return { blocked: "Possible access token. Remove it locally before importing.", review: null };
  if (connection.test(body)) return { blocked: null, review: "Connection URL with a password kept. It may be an example or a real credential." };
  for (const hit of body.matchAll(assignment)) if (concreteValue(hit[1], hit[2]))
    return { blocked: null, review: "Possible credential value kept. It may be an example or a real credential." };
  return { blocked: null, review: null };
}

// Redacted transcripts are derived text. The user's original export is never rewritten.
export function redactConversationText(body: string): { text: string; redactions: number } {
  let redactions = 0;
  const removed = () => { redactions++; return "[secret removed]"; };
  let text = body.replace(/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|$)/g, removed);
  text = text.replace(new RegExp(token.source, "g"), removed);
  return { text, redactions };
}
