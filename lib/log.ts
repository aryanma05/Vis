// Enkel logging. I produksjon skrives én JSON-linje per hendelse, så loggene hos
// Render/Vercel kan søkes i og filtreres. Under utvikling skrives de lesbart.

type Level = "debug" | "info" | "warn" | "error";
type Data = Record<string, unknown>;

const isProd = process.env.NODE_ENV === "production";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 8).join("\n") };
  }
  return { message: String(error) };
}

function write(level: Level, event: string, data: Data = {}) {
  if (level === "debug" && isProd) return;
  const payload: Data = { ...data };
  if ("error" in payload) payload.error = serializeError(payload.error);

  if (isProd) {
    const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...payload });
    (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
    return;
  }

  const prefix = `[${event}]`;
  const rest = Object.keys(payload).length > 0 ? payload : "";
  if (level === "error") console.error(prefix, rest);
  else if (level === "warn") console.warn(prefix, rest);
  else console.log(prefix, rest);
}

export const log = {
  debug: (event: string, data?: Data) => write("debug", event, data),
  info: (event: string, data?: Data) => write("info", event, data),
  warn: (event: string, data?: Data) => write("warn", event, data),
  error: (event: string, data?: Data) => write("error", event, data),
};
