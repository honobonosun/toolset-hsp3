import {
  Disposable,
  ExtensionContext,
  ShellExecution,
  Task,
  TaskScope,
  commands,
  env,
  tasks,
  window,
} from "vscode";
import { Agent } from "./agent";
import { Override } from "./override";
import { provider } from "./provider";
import { platform } from "node:os";
import { i18n, init } from "./i18n";

/*
import { I18n } from "i18n";
import { join } from "node:path";

import i18next, { i18n } from "i18next";
import jaLocales from "../locales/ja.json";
import enLocales from "../locales/en.json";
*/

export async function activate(context: ExtensionContext) {
  await init(env.language);
  //await i18n.changeLanguage(env.language);
  console.log(i18n.t("activation", { name: "toolset-hsp3" }));

  const extension = new Extension(context);
  context.subscriptions.push(extension);
  extension.agent.method.registryToolsetProvider(provider);
  await extension.agent.load();
  return extension.method;
}
export function deactivate() {}

class Extension implements Disposable {
  agent: Agent;
  override: Override;
  constructor(private context: ExtensionContext) {
    this.agent = new Agent(context);
    this.override = new Override(context, this.agent.method);

    context.subscriptions.push(
      commands.registerCommand("toolset-hsp3.open", () => {
        const hsp3dir = this.agent.method.hsp3dir();
        if (hsp3dir) this.open(hsp3dir);
        else window.showErrorMessage(i18n.t("hsp3root-no-selected"));
      })
    );
  }

  public dispose(): void {
    return;
  }

  public method = () => ({
    agent: this.agent.method,
    override: { override: this.override.override() },
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
    tasks.executeTask(
      new Task(
        { type: "shell", command, cwd: dist },
        TaskScope.Workspace,
        "open hsp3root",
        "toolset-hsp3.taskrunner",
        new ShellExecution(command, { cwd: dist })
      )
    );
  }
}
