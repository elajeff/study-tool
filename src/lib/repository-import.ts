import { matchImportFiles, type ImportFile } from "./import-files.ts";

export type RepositoryFile = { artifact_id: string; path: string | null; revision_id: string | null; content_hash: string | null };

export function shouldImportRepositoryFile(path: string) {
  if (/(^|\/)(\.git|node_modules|vendor|dist|build|target|out|coverage|\.next|\.venv|venv|__pycache__|\.idea)(\/|$)/i.test(path)) return false;
  const name = path.split("/").at(-1)!;
  if (/^(\.env(?:\..*)?|id_(rsa|dsa|ecdsa|ed25519)|credentials(?:\..*)?|secrets?\.(json|ya?ml|txt)|package-lock\.json|pnpm-lock\.yaml)$/i.test(name)
    || /\.(pem|key|p12|pfx|jks|keystore|min\.js|map)$/i.test(name)) return false;
  return /\.(java|tsx?|[cm]?jsx?|py|sql|ya?ml|json|md|markdown|rst|html|css|scss|xml|properties|toml|conf|cfg|ini|gradle|sh|ps1|bat|cmd|txt|c|h|cpp|go|rs|kt|rb)$/i.test(name)
    || /^(Dockerfile|Makefile|mvnw|gradlew|\.gitignore|\.dockerignore)$/i.test(name);
}

export function inspectRepositoryText(body: string): { blocked: string | null; review: string | null } {
  if (/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(body)) return { blocked: "Possible private key. Remove it locally before importing.", review: null };
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/.test(body))
    return { blocked: "Possible access token. Remove it locally before importing.", review: null };
  if (/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^/\s:@]+:[^@\s]+@/i.test(body))
    return { blocked: null, review: "Possible credentials in a connection URL. Review the text before including this file." };
  const assignments = body.matchAll(/\b(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret|secret(?:[_-]?key)?|private[_-]?key|aws_secret_access_key|token)\b["']?\s*[=:]\s*(?:["']([^"'\r\n]+)["']|([A-Za-z0-9_+/.=-]+))/gi);
  for (const assignment of assignments) {
    if (assignment[2] && /^(null|undefined|true|false)$/i.test(assignment[2])) continue;
    if (!/^(\$\{|process\.env\.|os\.environ|os\.getenv|System\.getenv)/.test(assignment[1] ?? assignment[2]))
      return { blocked: null, review: "Possible credential value. Review the text before including this file." };
  }
  return { blocked: null, review: null };
}

export function previewRepository(files: ImportFile[], state: RepositoryFile[], bindings: Record<string, string> = {}) {
  return matchImportFiles(files, state, bindings).map((row) => ({ ...row,
    status: row.identityConflict ? "Conflict" : !row.previous ? "New" : row.previous.content_hash === row.file.hash ? "Unchanged" : "Updated",
  }));
}
