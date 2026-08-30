export const SIGN_COLUMNS = 18;
export const SIGN_LINES = 4;

export function fitSignText(value, columns = SIGN_COLUMNS, maxLines = SIGN_LINES) {
  const normalized = String(value ?? "").replaceAll("\r", "").replaceAll("\t", " ");
  const lines = [""];
  let text = "";
  let full = false;

  for (const character of normalized) {
    if (character === "\n") {
      if (lines.length >= maxLines) { full = true; break; }
      lines.push("");
      text += character;
      continue;
    }
    if (lines[lines.length - 1].length >= columns) {
      if (lines.length >= maxLines) { full = true; break; }
      lines.push("");
    }
    lines[lines.length - 1] += character;
    text += character;
  }

  return { text, lines, full };
}
