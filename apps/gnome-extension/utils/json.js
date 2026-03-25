function previewText(text) {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return "<empty>";
  }

  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;
}

export function parseStrictJson(text, source = "backend stdout") {
  if (typeof text !== "string") {
    throw new TypeError(`Expected ${source} to be a string, received ${typeof text}`);
  }

  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new Error(`Invalid JSON from ${source}: ${previewText(text)}`, { cause });
  }
}
