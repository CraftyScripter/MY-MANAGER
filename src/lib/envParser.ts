export interface ParsedEnvVar {
  key: string;
  value: string;
}

export interface ParsedEnvLine {
  line: number;
  content: string;
  reason: string;
}

export interface ParseResult {
  valid: ParsedEnvVar[];
  invalid: ParsedEnvLine[];
}

export function parseEnvFile(content: string): ParseResult {
  const lines = content.split("\n");
  const valid: ParsedEnvVar[] = [];
  const invalid: ParsedEnvLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    const trimmed = raw.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      invalid.push({ line: lineNum, content: raw, reason: "Missing '=' separator" });
      continue;
    }

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1);

    if (key.length === 0) {
      invalid.push({ line: lineNum, content: raw, reason: "Empty key name" });
      continue;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      invalid.push({ line: lineNum, content: raw, reason: `Invalid key name "${key}"` });
      continue;
    }

    value = value.trim();

    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.substring(1, value.length - 1);
      }
    }

    value = value
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/, "\\")
      .trim();

    valid.push({ key, value });
  }

  return { valid, invalid };
}

export function formatEnvFile(variables: Array<{ key: string; value: string }>): string {
  return variables
    .map(({ key, value }) => {
      if (value.includes("\n") || value.includes(" ") || value.includes("#") || value.includes("=")) {
        const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return `${key}="${escaped}"`;
      }
      return `${key}=${value}`;
    })
    .join("\n");
}
