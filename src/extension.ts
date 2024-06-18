import {
  Disposable,
  ExtensionContext,
  ExtensionMode,
  commands,
  env,
  window,
  workspace,
} from "vscode";
import { Agent } from "./agent";
import { Override } from "./override";
import { provider } from "./provider";
import { platform } from "node:os";
import { i18n, init } from "./i18n";
import { LogLevel, LogWriter } from "./log";
import { TaskEnv } from "./env";
import { Launcher } from "./launch";
import { exec } from "node:child_process";
import { EXTENSION_NAME } from "./constant";

export async function activate(context: ExtensionContext) {
  // 表示言語の初期化
  await init(env.language, {
    debug: context.extensionMode === ExtensionMode.Development,
  });
  //await i18n.changeLanguage(env.language);
  LogWriter.init();
  LogWriter.dubbing = context.extensionMode === ExtensionMode.Development;
  if (context.extensionMode === ExtensionMode.Development)
    LogWriter.outcha.appendLine(i18n.t("activation"));

  const updateLogConfig = () => {
    const cfg = workspace.getConfiguration(EXTENSION_NAME);
    LogWriter.autoPop = cfg.get<boolean>("log.autoPop") ?? true;
    LogWriter.infoLimit = cfg.get<LogLevel>("log.infoLimit") ?? "error";
  };
  updateLogConfig();
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(EXTENSION_NAME)) updateLogConfig();
    })
  );

  // 拡張機能の初期化
  const extension = new Extension(context);
  context.subscriptions.push(extension);
  extension.agent.method.registryToolsetProvider(provider);
  await extension.agent.load();
  extension.taskenv.update();
  return extension.method();
}
export function deactivate() {
  LogWriter.dispose();
}

class Extension implements Disposable {
  agent: Agent;
  override: Override;
  taskenv: TaskEnv;
  launcher: Launcher;
  log: LogWriter;
  constructor(private context: ExtensionContext) {
    this.log = new LogWriter("Extension");
    this.agent = new Agent(context);
    this.override = new Override(context, this.agent.method);
    this.taskenv = new TaskEnv(context, this.agent.method);
    this.launcher = new Launcher(context, this.agent.method);

    context.subscriptions.push(
      commands.registerCommand("toolset-hsp3.open", () => {
        const hsp3dir = this.agent.method.hsp3root();
        if (hsp3dir) this.open(hsp3dir);
        else window.showErrorMessage(i18n.t("hsp3root-no-selected"));
      })
    );
  }

  public dispose(): void {
    this.launcher.dispose();
    this.taskenv.dispose();
    this.override.dispose();
    this.agent.dispose();
    return;
  }

  public method = () => ({
    agent: this.agent.method,
    override: { override: () => this.override.override() },

    // v0.x系の公開API、廃止予定のため非推奨。
    current: this.agent.method.current,
    hsp3dir: this.agent.method.hsp3root,
    showSelect: () => this.agent.showSelect(),

    registryToolsetProvider: (
      name: string,
      provider: {
        resolve(
          patterns: string[]
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ): Promise<{ errors: any[]; items: { name: string; path: string }[] }>;
      }
    ): { dispose: () => void } => {
      return this.agent.method.registryToolsetProvider({
        name,
        async resolve(patterns) {
          const { errors, items } = await provider.resolve(patterns);
          return {
            errors,
            items,
          };
        },
      });
    },
  });

  // distに指定されたディレクトリパスをファイルマネージャーで開く
  public async open(dist: string): Promise<void> {
    const command = ((path) => {
      switch (platform()) {
        case "win32":
          return "explorer.exe .";
        case "darwin":
          return `open ${path}`;
        default:
          return process.env.WSL_DISTRO_NAME !== undefined
            ? "explorer.exe ."
            : "xdg-open .";
      }
    })(dist);

    const child = exec(command, { cwd: dist });
    this.log.info(`launch command "${command}" PID[${child.pid ?? 0}]`);
    child.on("exit", (code) => {
      this.log.info(
        `launched command "${command}" PID[${child.pid ?? 0}] exit (${code}).`
      );
    });
  }
}
