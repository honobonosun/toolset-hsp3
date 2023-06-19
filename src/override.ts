import { Disposable, commands, window, workspace } from "vscode";
import { Extension } from "./extension";

export class Override implements Disposable {
  subscriptions: Disposable[] = [];
  init = true;
  constructor(private methods: Extension["methods"]) {
    this.subscriptions.push(
      workspace.onDidChangeConfiguration((e) => {
        const cfg = workspace.getConfiguration("toolset-hsp3");
        if (cfg.get("override.applyChangesImmediately")) {
          if (
            e.affectsConfiguration("toolset-hsp3.override.list") ||
            e.affectsConfiguration("toolset-hsp3.override.scope")
          )
            this.override();
        }
      }),
      methods.onDidChangeCurrent((item) => {
        const prevent = this.init;
        if (this.init === true) this.init = false;
        const cfg = workspace.getConfiguration("toolset-hsp3");
        if (cfg.get("override.applyChangesImmediately")) this.override(prevent);
      })
    );
  }

  dispose() {
    for (const item of this.subscriptions) item.dispose();
  }

  async override(prevent: boolean = false) {
    const mycfg = workspace.getConfiguration("toolset-hsp3");

    if (!mycfg.get("override.enable")) return;
    const scope = mycfg.get("override.scope") as boolean | null | undefined;

    const hsp3root = await this.methods.hsp3dir();
    if (!hsp3root) return;

    const list = mycfg.get("override.list") as string[] | undefined;
    if (!list) {
      window.showErrorMessage('No setting in "toolset-hsp3.override.list".');
      return;
    }

    const split = /(.*?)(?:\.)(.*)/;
    for (const item of list) {
      if (item.length === 0) continue;
      const result = split.exec(item);
      if (result?.length === 3) {
        if (result[0] === "toolset-hsp3.current") continue; // 自分自身を対象にしない。

        const extcfg = workspace.getConfiguration(result[1]);
        if (!extcfg.has(result[2])) {
          window.showWarningMessage(
            `There is no setting "${result[0]}". Override was skipped.`
          );
          continue;
        }

        try {
          await extcfg.update(result[2], hsp3root, scope);
        } catch (error) {
          window.showErrorMessage(
            `Error : toolset-hsp3 other extension config override is failure. [${
              (error as Error).message
            }]`
          );
        }
      }
    }

    if (
      mycfg.get("override.applyChangesImmediatelyInReloadWindow") &&
      prevent === false
    )
      await commands.executeCommand("workbench.action.reloadWindow");
  }
}
