import {
  Disposable,
  ExtensionContext,
  WorkspaceConfiguration,
  workspace,
} from "vscode";
import { Agent } from "./agent";
import { EXTENSION_NAME } from "./constant";
import { env } from "process";
import { platform } from "os";

type PriorityHsp3Root = "top" | "second" | "bottom";
type priorityPath = "top" | "bottom";

export class TaskEnv implements Disposable {
  constructor(
    private readonly context: ExtensionContext,
    private readonly agentMethods: Agent["method"]
  ) {
    context.subscriptions.push(
      agentMethods.onDidChangeCurrent(() => {
        this.update();
      }),
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(EXTENSION_NAME)) this.update();
      })
    );
  }

  public dispose() {}

  private updateHsp3Root(cfg: WorkspaceConfiguration) {
    const hsp3root = this.agentMethods.hsp3root();
    if (!hsp3root) {
      this.context.environmentVariableCollection.delete("HSP3_ROOT");
      return;
    }

    if (cfg.get<boolean>("env.HSP3_ROOT.enable")) {
      if (cfg.get<boolean>("env.HSP3_ROOT.single")) {
        this.context.environmentVariableCollection.replace(
          "HSP3_ROOT",
          hsp3root
        );
      } else {
        const separator = platform() === "win32" ? ";" : ":";
        const priority =
          cfg.get<PriorityHsp3Root>("env.HSP3_ROOT.priority") ?? "top";

        const save = {
          top: () => {
            this.context.environmentVariableCollection.prepend(
              "HSP3_ROOT",
              hsp3root + separator
            );
          },
          second: () => {
            const hsp3roots: string[] = env.HSP3_ROOT?.split(separator) ?? [];
            hsp3roots.splice(1, 0, hsp3root);
            this.context.environmentVariableCollection.replace(
              "HSP3_ROOT",
              hsp3roots.join(separator)
            );
          },
          bottom: () => {
            this.context.environmentVariableCollection.append(
              "HSP3_ROOT",
              separator + hsp3root
            );
          },
        };
        save[priority]();
      }
    } else {
      this.context.environmentVariableCollection.delete("HSP3_ROOT");
    }
  }

  updatePath(cfg: WorkspaceConfiguration) {
    const hsp3root = this.agentMethods.hsp3root();
    if (!hsp3root) {
      this.context.environmentVariableCollection.delete("PATH");
      return;
    }

    if (cfg.get<boolean>("env.PATH.enable")) {
      const separator = platform() === "win32" ? ";" : ":";
      const priority = cfg.get<priorityPath>("env.PATH.Priority") ?? "top";
      if (priority === "top") {
        this.context.environmentVariableCollection.prepend(
          "PATH",
          hsp3root + separator
        );
      } else {
        this.context.environmentVariableCollection.append(
          "PATH",
          separator + hsp3root
        );
      }
    } else {
      this.context.environmentVariableCollection.delete("PATH");
    }
  }

  update() {
    const cfg = workspace.getConfiguration(EXTENSION_NAME);
    if (cfg.get<boolean>("env.enable")) {
      this.updateHsp3Root(cfg);
      this.updatePath(cfg);
    } else {
      this.context.environmentVariableCollection.clear();
    }
  }
}
