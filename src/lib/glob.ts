/**
 * Match a value against a glob pattern.
 * Supports `*` (any characters) and `?` (single character).
 */
export function matchGlob(pattern: string, value: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(value);
}

/**
 * Check if a value matches any pattern in an array.
 * Returns true if patterns is empty (unconstrained).
 */
export function matchAnyGlob(patterns: string[], value: string): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((p) => matchGlob(p, value));
}

function globToRegex(pattern: string): RegExp {
  let regex = "^";
  for (const char of pattern) {
    switch (char) {
      case "*":
        regex += ".*";
        break;
      case "?":
        regex += ".";
        break;
      case ".":
      case "(":
      case ")":
      case "+":
      case "^":
      case "$":
      case "|":
      case "{":
      case "}":
      case "[":
      case "]":
      case "\\":
        regex += "\\" + char;
        break;
      default:
        regex += char;
    }
  }
  regex += "$";
  return new RegExp(regex);
}
