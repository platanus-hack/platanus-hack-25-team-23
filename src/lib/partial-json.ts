/**
 * Extracts the value of a specific key from a potentially incomplete JSON string.
 * This is useful for streaming LLM tool arguments where we want to display the content
 * as it arrives, before the JSON is fully valid.
 */
export function extractAttributeFromPartialJson(jsonStr: string, key: string): string | null {
  if (!jsonStr) return null;

  // 1. Try standard JSON parse first (best case)
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object' && key in parsed) {
      return parsed[key];
    }
  } catch (e) {
    // Ignore error, proceed to heuristic parsing
  }

  // 2. Heuristic Regex Parsing
  // We look for "key": "value...
  // We need to handle:
  // - whitespace
  // - escaped quotes \"
  // - newlines
  
  // Regex explanation:
  // "key" \s* : \s* "  -> Match the key and opening quote
  // ( (?: [^"\\] | \\. )* ) -> Capture content: anything that isn't a quote or backslash, OR an escaped character
  // The content capture group is lazy/greedy depending on if we see the closing quote.
  
  // Since the string is incomplete, we might not have the closing quote.
  // We just want to capture everything after the opening quote of the value.
  
  const keyPattern = `"${key}"\\s*:\\s*"`;
  const regex = new RegExp(keyPattern);
  const match = jsonStr.match(regex);

  if (!match) return null;

  const startIndex = match.index! + match[0].length;
  let content = '';
  let isEscaped = false;

  // Iterate from the start of the value
  for (let i = startIndex; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (isEscaped) {
      // Handle standard JSON escapes
      if (char === 'n') content += '\n';
      else if (char === 't') content += '\t';
      else if (char === 'r') content += '\r';
      else if (char === '"') content += '"';
      else if (char === '\\') content += '\\';
      else content += char; // Fallback for others
      
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      // Found closing quote - we are done (even if string continues, we assume value ended)
      break;
    }

    content += char;
  }

  return content;
}
