import { window } from "vscode";

export type LogLevel = "info" | "warn" | "error";

const c = {
  info: console.info,
  warn: console.warn,
  error: console.error,
} as const;

export class LogWriter {
  static outcha: import("vscode").OutputChannel;

  static init() {
    LogWriter.outcha = window.createOutputChannel("toolset-hsp3");
  }
  static dispose() {
    LogWriter.outcha.dispose();
  }
  /** コンソールへログを転送するか？trueで転送する。 */
  static dubbing: boolean = false;

  static readonly Level = {
    info: "info",
    warn: "warn",
    error: "error",
  } as const;

  constructor(private name: string) {
    if (name.match(":")) throw new Error("「:」文字は予約されています。");
  }

  write(level: LogLevel, message: string, args?: unknown[]) {
    const out = `${this.name} : ${message}`;
    LogWriter.outcha.appendLine(`${level} : ${out}`);
    if (LogWriter.dubbing) c[level](out);

    if (args)
      args
        .map((val) => (typeof val === "string" ? val : String(val)))
        .forEach((str) => {
          LogWriter.outcha.appendLine(str);
          if (LogWriter.dubbing) c[level](str);
        });
  }

  info(message: string, args?: unknown[]) {
    this.write("info", message, args);
  }

  warn(message: string, args?: unknown[]) {
    this.write("warn", message, args);
  }

  error(message: string, args?: unknown[]) {
    this.write("error", message, args);
  }

  show(focus: boolean = false) {
    LogWriter.outcha.show(focus);
  }
}

/*
let a = new LogLighter("namespace");
a.write(LogLighter.Level.info, "info message", args)
*/
