import { Disposable, commands, extensions, window, workspace } from "vscode";
import { Extension } from "./extension";

interface PackageElm {
  antiOverride?: boolean;
  reloadWindow?: boolean;
}

interface overrideItem {
  raw: string;
  publisher: string;
  extension: string;
  key: string;
}

const splitRegexp = /(.*?)(?:\.)(.*?)(?:\.)(.*)/;

const memo = new Map<string, PackageElm>(); // packageJSONが動的に上書きされるのであれば、このメモ化は同期不良を起こします。

export class Override implements Disposable {
  subscriptions: Disposable[] = [];
  init = true;
  constructor(private methods: Extension["methods"]) {
    this.subscriptions.push(
      workspace.onDidChangeConfiguration((e) => {
        const cfg = workspace.getConfiguration("toolset-hsp3");
        if (cfg.get("override.applyChangesImmediately")) {
          if (e.affectsConfiguration("toolset-hsp3.override.list"))
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

  split(elm: string): overrideItem | undefined {
    const result = splitRegexp.exec(elm);
    if (result?.length === 4) {
      return {
        raw: elm,
        publisher: result[1],
        extension: result[2],
        key: result[3],
      };
    } else return undefined;
  }

  packageKind(item: overrideItem): PackageElm | undefined {
    const extensionId = [item.publisher, item.extension].join(".");
    if (!memo.has(extensionId)) {
      const packageJSON = extensions.getExtension(extensionId)?.packageJSON;
      console.log("packageKind", item.extension, packageJSON);

      if (packageJSON && packageJSON["toolset-hsp3"]) {
        memo.set(extensionId, {
          antiOverride: packageJSON["toolset-hsp3"].antiOverride,
          reloadWindow: packageJSON["toolset-hsp3"].reloadWindow,
        });
      } else {
        memo.set(extensionId, {
          antiOverride: undefined,
          reloadWindow: undefined,
        });
      }
    }
    return memo.get(extensionId);
  }

  async override(prevent: boolean = false) {
    const mycfg = workspace.getConfiguration("toolset-hsp3");

    if (!mycfg.get("override.enable")) return;
    const scope = true;

    const hsp3root = await this.methods.hsp3dir();
    if (!hsp3root) return;

    const list = mycfg.get("override.list") as string[] | undefined;
    if (!list) {
      window.showErrorMessage('No setting in "toolset-hsp3.override.list".');
      return;
    }

    let reloadWindow = false;

    for (const item of list) {
      if (item.length === 0) continue;
      const words = this.split(item);
      if (words) {
        if (words.extension === "toolset-hsp3") continue; // 自分自身を対象にしない。

        const packageKind = this.packageKind(words);
        if (packageKind?.antiOverride === true) continue;
        if (packageKind?.reloadWindow === true && reloadWindow === false)
          reloadWindow = true;

        const extcfg = workspace.getConfiguration(words.extension);
        if (!extcfg.has(words.key)) {
          window.showWarningMessage(
            `There is no setting "${words.raw}". Override was skipped.`
          );
          continue;
        }

        try {
          await extcfg.update(words.key, hsp3root, scope);
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
    else if (prevent === false && reloadWindow === true) {
      window.showWarningMessage(
        "Some extensions require the window to be reloaded. Due to the current configuration, window reloading was not performed automatically. Note that some extensions will not work as expected if window reloading is not performed."
      );
    }
  }
}
