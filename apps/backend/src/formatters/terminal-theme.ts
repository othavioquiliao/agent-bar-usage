const RESET = '\u001B[0m';
const BOLD = '\u001B[1m';
const DIM = '\u001B[2m';

function rgb(red: number, green: number, blue: number): string {
  return `\u001B[38;2;${red};${green};${blue}m`;
}

export const TERMINAL_THEME = {
  reset: RESET,
  bold: BOLD,
  dim: DIM,
  text: rgb(171, 178, 191),
  textBright: rgb(230, 237, 243),
  comment: rgb(127, 132, 142),
  blue: rgb(97, 175, 239),
  yellow: rgb(229, 192, 123),
  green: rgb(152, 195, 121),
  red: rgb(224, 108, 117),
  cyan: rgb(86, 182, 194),
  magenta: rgb(198, 120, 221),
} as const;

export const PROVIDER_ACCENTS: Record<string, string> = {
  claude: TERMINAL_THEME.yellow,
  codex: TERMINAL_THEME.blue,
  copilot: TERMINAL_THEME.green,
};

export function colorize(text: string, color: string, options: { bold?: boolean; dim?: boolean } = {}): string {
  const prefix = `${options.bold ? TERMINAL_THEME.bold : ''}${options.dim ? TERMINAL_THEME.dim : ''}${color}`;
  return `${prefix}${text}${TERMINAL_THEME.reset}`;
}
