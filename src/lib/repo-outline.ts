type Outline = { lines: string[]; truncated: boolean; supported: boolean; warning: string | null };

/** Navigation hints from syntax patterns, never a claim of complete semantic analysis. */
export function repositoryOutline(path: string, text: string): Outline {
  const extension = path.split('.').at(-1)?.toLowerCase();
  let pattern: RegExp | undefined;
  switch (extension) {
    case 'py': pattern = /^\s*(?:async\s+)?(?:def|class)\s+\w+.*$/; break;
    case 'ts': case 'tsx': case 'js': case 'jsx': case 'mjs': case 'cjs':
      pattern = /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|interface|type|const)\s+\w+.*$/; break;
    case 'java':
      pattern = /^\s*(?:(?:public|protected|private|final|abstract|static|sealed)\s+)*(?:class|interface|record|enum)\s+\w+.*$|^\s*@(?:Get|Post|Put|Patch|Delete|Request)Mapping\b.*$|^\s+(?:public|protected|private)\s+(?:static\s+)?[\w<>\[\], ?]+\s+\w+\([^;]*\)\s*(?:throws [\w, ]+)?\s*\{/; break;
    case 'sql': pattern = /^\s*(?:create|alter)\s+(?:unique\s+)?(?:table|index|type|view)\s+.*$/i; break;
    case 'md': case 'markdown': pattern = /^\s{0,3}#{1,6}\s+.*$/; break;
    case 'yaml': case 'yml': pattern = /^[\w-]+:.*$/; break;
    case 'xml': pattern = /^\s*<(?:groupId|artifactId|version|java.version)>.*$/; break;
  }
  let lines: string[] = [];
  if (path.split('/').at(-1) === 'package.json') {
    try {
      const manifest = JSON.parse(text);
      for (const field of ['dependencies', 'devDependencies', 'scripts']) {
        const values = manifest?.[field];
        if (values && typeof values === 'object' && !Array.isArray(values))
          lines.push(`${field}: ${Object.keys(values).join(', ')}`);
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return { lines: [], truncated: false, supported: true, warning: 'This manifest is not valid JSON.' };
    }
  } else if (pattern) {
    lines = text.split(/\r?\n/).filter((line) => pattern.test(line));
  }
  return {
    lines: lines.slice(0, 30).map((line) => line.trim().slice(0, 240)),
    truncated: lines.length > 30 || lines.some((line) => line.trim().length > 240),
    supported: !!pattern || path.split('/').at(-1) === 'package.json', warning: null,
  };
}
