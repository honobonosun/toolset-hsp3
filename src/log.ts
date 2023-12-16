import { window } from "vscode";
import { i18n } from "./i18n";

let time: NodeJS.Timeout | undefined;

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
  /** ログの通知が必要なレベル info(全部) > warn > error(だけ) */
  static infoLimit: LogLevel = "error";
  /** ログが更新されたことを通知するか */
  static autoPop: boolean = true;

  static write(
    name: string,
    level: LogLevel,
    message: string,
    args?: unknown[]
  ) {
    const out = `${name} : ${message}`;
    LogWriter.outcha.appendLine(`${level} : ${out}`);
    if (LogWriter.dubbing) c[level](out);

    if (args)
      args
        .map((val) => (typeof val === "string" ? val : String(val)))
        .forEach((str) => {
          LogWriter.outcha.appendLine(str);
          if (LogWriter.dubbing) c[level](str);
        });

    const int = (level: LogLevel) => {
      switch (level) {
        case "info":
          return 0;
        case "warn":
          return 1;
        case "error":
          return 2;
      }
    };

    if (LogWriter.autoPop && int(level) >= int(LogWriter.infoLimit)) {
      if (time) clearTimeout(time);
      const label = i18n.t("show") ?? "Show";
      time = setTimeout(async () => {
        const val = await window.showInformationMessage(
          i18n.t("unread-log"),
          label
        );
        if (val === label) LogWriter.outcha.show();
      }, 1000);
    }
  }

  constructor(private name: string) {
    if (name.match(":")) throw new Error("「:」文字は予約されています。");
  }

  write(level: LogLevel, message: string, args?: unknown[]) {
    LogWriter.write(this.name, level, message, args);
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
