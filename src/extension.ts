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

import { I18n } from "i18n";
import { join } from "node:path";

import i18next from "i18next";
import jaBook from "../locales/ja.json";

export async function activate(context: ExtensionContext) {
  // i18n-node
  const i18n = new I18n({
    directory: join(context.extensionPath, "locales"),
    defaultLocale: env.language,
  });
  console.log(i18n.getCatalog());
  i18n.setLocale(env.language);
  console.log(i18n.getLocale());
  const t = i18n.__mf;
  console.log(t("hello"));

  // i18next
  i18next
    .init({
      lng: "ja",
      debug: true,
      resources: {
        ja: {
          translation: {
            key: "こんにちは！",
          },
        },
      },
    })
    .then((val) => {
      console.log(val);
      console.log(i18next.t("key"));
    });

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
        else window.showErrorMessage("hsp3root is not selected.");
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
