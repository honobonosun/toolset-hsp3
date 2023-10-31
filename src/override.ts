import {
  ConfigurationTarget,
  Disposable,
  ExtensionContext,
  ExtensionKind,
  ExtensionMode,
  commands,
  extensions,
  l10n,
  window,
  workspace,
} from "vscode";
import { ZodError, z } from "zod";
import { EXTENSION_NAME } from "./constant";
import * as path from "node:path";
import * as os from "node:os";
import * as semver from "semver";
import * as micromatch from "micromatch";
import { Agent } from "./agent";

const zScope = z.enum([
  "undefined",
  "false",
  "true",
  "Global",
  "Workspace",
  "WorkspaceFolder",
]);
type TypedScope = z.infer<typeof zScope>;

const zListExElm = z.object({
  publisher: z.string(),
  id: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
  platform: z.optional(z.string()),
  scope: zScope,
});
type TypedListExElm = z.infer<typeof zListExElm>;

const zContributes = z.object({
  version: z.string(),
  enable: z.boolean(),
  settings: z.optional(
    z.array(
      z.object({
        id: z.string(),
        value: z.union([z.string(), z.array(z.string())]),
        platform: z.optional(z.string()),
        scope: zScope,
      })
    )
  ),
  reloadWindow: z.optional(z.boolean()),
});

type TypedContributes = z.infer<typeof zContributes>;

interface Setting {
  report: string;
  publisher: string;
  section: string;
  key: string;
  value: string[];
  platform?: string;
  scope: TypedScope;
}

interface SettingStruct {
  reload: boolean;
  settings: Setting[];
}

const cfgTarget = (
  word: TypedScope
): ConfigurationTarget | boolean | null | undefined => {
  switch (word) {
    case "undefined":
      return undefined;
    case "false":
      return false;
    case "true":
      return true;
    case "Global":
      return ConfigurationTarget.Global;
    case "Workspace":
      return ConfigurationTarget.Workspace;
    case "WorkspaceFolder":
      return ConfigurationTarget.WorkspaceFolder;
    default:
      return true;
  }
};

const splitRegexp = {
  long: /(.*?)(?:\.)(.*?)(?:\.)(.*)/,
  short: /(.*?)(?:\.)(.*)/,
};

const replaceRegexp = /%(.*?)%/g;

export class Override implements Disposable {
  private subscriptions: Disposable[] = [];
  private init = false;
  private hsp3root: string | undefined;
  private cfg = workspace.getConfiguration(EXTENSION_NAME);
  private sc = new Map<string, string>();
  private struct: SettingStruct | undefined;

  constructor(
    private context: ExtensionContext,
    private methods: Agent["method"]
  ) {
    this.subscriptions.push(
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(EXTENSION_NAME))
          this.cfg = workspace.getConfiguration(EXTENSION_NAME);

        if (this.cfg.get("override.applyChangesImmediately")) {
          if (
            e.affectsConfiguration("toolset-hsp3.override.list") ||
            e.affectsConfiguration("toolset-hsp3.override.listEx") ||
            e.affectsConfiguration("toolset-hsp3.override.ignores")
          ) {
            this.struct = undefined;
            this.override();
          }
        }
      }),
      methods.onDidChangeCurrent(async (item) => {
        await this.updateHsp3Root();
        const reloadWindow = this.init;
        if (this.init === false) this.init = true;
        const cfg = workspace.getConfiguration(EXTENSION_NAME);
        if (cfg.get("override.applyChangesImmediately"))
          this.override(reloadWindow);
      }),
      extensions.onDidChange(() => this.override())
    );
  }

  dispose() {
    for (const item of this.subscriptions) item.dispose();
  }

  logWrite(str: string) {
    window.showInformationMessage(str);
  }

  async updateHsp3Root() {
    this.hsp3root = await this.methods.hsp3dir();
    if (this.hsp3root) this.sc.set("HSP3_ROOT", this.hsp3root);
    else this.sc.delete("HSP3_ROOT");
  }

  getExtensionAllJSON() {
    let list = [] as { id: string; json: any }[];
    extensions.all.forEach((elm) => {
      list.push({ id: elm.id, json: elm.packageJSON });
    });
    return list;
  }

  split = {
    section_key: (word: string) => {
      const reval = splitRegexp.short.exec(word);
      if (reval?.length === 3)
        return {
          raw: reval[0],
          section: reval[1],
          key: reval[2],
        };
      else return undefined;
    },
    publisher: (word: string) => {
      const reval = splitRegexp.short.exec(word);
      if (reval?.length === 3)
        return {
          raw: reval[0],
          publisher: reval[1],
          extension: reval[2],
        };
    },
    long: (word: string) => {
      const reval = splitRegexp.long.exec(word);
      if (reval?.length === 4)
        return {
          raw: reval[0],
          publisher: reval[1],
          extension: reval[2],
          key: reval[3],
        };
      return undefined;
    },
  };

  /**
   * 特殊文字置き換え
   * 今回のは、keyは完全一致になるため、大文字小文字の違いに注意してください。
   */
  replace(word: string): string {
    return (
      word.replace(
        replaceRegexp,
        (body, key: string) => this.sc.get(key) ?? body
      ) ?? word
    );
  }

  listingConfg(): SettingStruct {
    let reload = false;
    const settings: Setting[] = [];
    const scope = this.cfg.get<TypedScope>("override.scope") ?? "true";

    const list1 = this.cfg.get("override.list") as string[] | undefined;
    if (!list1) return { settings, reload };
    for (const elm of list1) {
      const word = this.split.long(elm);
      if (!word) continue;
      settings.push({
        report: `config:[${elm}]`,
        publisher: word.publisher,
        section: word.extension,
        key: word.key,
        value: ["%HSP3_ROOT%"],
        scope,
      });
    }

    const list2 = this.cfg.get<TypedListExElm[]>("override.listEx");
    const items = z.array(zListExElm).safeParse(list2);
    if (items.success)
      for (const item of items.data) {
        const word = this.split.section_key(item.id);
        if (!word) continue;
        settings.push({
          report: `config:[${item.publisher}.${item.id}]`,
          publisher: item.publisher,
          section: word.section,
          key: word.key,
          value: typeof item.value === "string" ? [item.value] : item.value,
          platform: item.platform,
          scope: item.scope,
        });
      }
    else {
      items.error.issues.forEach((item) =>
        window.showWarningMessage(
          l10n.t('"toolset-hsp3.override.listEx.{path}" is {message}', {
            path: item.path.join("."),
            message: item.message,
          })
        )
      );
    }

    return { settings, reload };
  }

  listingPackages(): SettingStruct {
    let reload = false;
    const settings: Setting[] = [];

    const v1 = (data: { id: string; json: TypedContributes }) => {
      if (!data.json.settings) return;
      if (data.json.reloadWindow === true) reload = true;
      for (const elm of data.json.settings) {
        if (elm.platform && elm.platform !== os.platform()) continue;
        const keys = this.split.section_key(elm.id);
        if (!keys) {
          this.logWrite(`${data.id}.settings.${elm.id} is wrong.`);
          continue;
        }

        const word = this.split.publisher(data.id);

        settings.push({
          report: `extension:[${word?.publisher ?? "undefined"}.${elm.id}]`,
          publisher: word?.publisher ?? "undefined",
          section: keys.section,
          key: keys.key,
          value: typeof elm.value === "string" ? [elm.value] : elm.value,
          platform: elm.platform,
          scope: elm.scope,
        });
      }
    };

    const jsons = extensions.all
      .map((elm) => ({
        id: elm.id,
        json: elm.packageJSON,
      }))
      .filter((elm) => elm.json["toolset-hsp3"]);

    for (const elm of jsons) {
      // 検証
      const result = zContributes.safeParse(elm.json["toolset-hsp3"]);
      if (result.success) {
        const configuration = result.data;
        // 有効確認
        if (configuration.enable === false) continue;
        // バージョン確認
        if (semver.valid(configuration.version)) {
          if (semver.satisfies(configuration.version, "1.x"))
            v1({ id: elm.id, json: elm.json["toolset-hsp3"] });
        }
      } else {
        this.logWrite(
          `error zod parse. [${elm.id}] : [${result.error.message}]`
        );
      }
    }

    return { settings, reload };
  }

  listing(): SettingStruct {
    const ignores =
      (this.cfg.get("override.ignores") as string[] | undefined) ?? [];
    if (this.context.extensionMode === ExtensionMode.Production)
      // リリース版ではglobを書き換えられないように除外リストへ追加する。
      ignores.push("honobonosun\\.toolset-hsp3\\.globs");

    let reload = false;
    let settings: Setting[] = [];

    try {
      const reval1 = this.listingConfg();
      const reval2 = this.listingPackages();

      if (reval1.reload || reval2.reload) reload = true;

      settings = reval1.settings
        .concat(reval2.settings)
        .filter(
          (val) =>
            !micromatch.isMatch(
              [val.publisher, val.section, val.key].join("."),
              ignores
            )
        );
    } catch (error) {
      if (error instanceof Error) this.logWrite(error.message);
      console.error(error);
    }

    return {
      settings,
      reload,
    };
  }

  async override(unlockReload: boolean = true) {
    if (!this.cfg.get("override.enable")) return;
    if (!this.hsp3root) return;

    // リストはメモする。
    if (!this.struct) this.struct = this.listing();
    const struct = this.struct;
    const platform = os.platform();

    const promises = [];

    // 設定を上書きする。
    for (const elm of struct.settings) {
      if (elm.platform && elm.platform !== platform) continue;

      const cfg = workspace.getConfiguration(
        elm.section,
        window.activeTextEditor?.document
      );
      if (!cfg.has(elm.key)) {
        window.showWarningMessage(
          l10n.t('There is no setting "{report}". Override was skipped.', {
            report: elm.report,
          })
        );
        continue;
      }
      const value = path.join(...elm.value.map((word) => this.replace(word)));

      const write = async (item: Setting, value: string) => {
        if (cfg.inspect(item.key)?.globalValue !== value)
          await cfg
            .update(item.key, value, cfgTarget(item.scope))
            .then(undefined, (error) => {
              console.error(error);
              window.showErrorMessage(
                l10n.t(
                  "Failed to override the settings of other extensions. [{message}]",
                  {
                    message: `"${[item.section, item.key].join(".")}" : "${
                      (error as Error).message
                    }"`,
                  }
                )
              );
            });
      };
      promises.push(write(elm, value));
    }

    await Promise.all(promises);

    // 書き換えた後、ウィンドウの再読み込みが必要なら再読み込みする。
    if (
      unlockReload &&
      struct.reload &&
      this.cfg.get("override.applyChangesImmediatelyInReloadWindow")
    )
      commands
        .executeCommand("workbench.action.reloadWindow")
        .then(undefined, (error) => {
          console.log(error);
        });
  }
}
