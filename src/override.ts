import {
  ConfigurationTarget,
  Disposable,
  ExtensionContext,
  ExtensionMode,
  commands,
  extensions,
  window,
  workspace,
} from "vscode";
import { z } from "zod";
import { EXTENSION_NAME } from "./constant";
import * as path from "node:path";
import * as os from "node:os";
import * as semver from "semver";
import * as micromatch from "micromatch";
import { Agent } from "./agent";
import { LogWriter } from "./log";
import { i18n } from "./i18n";
import * as docpath from "doc-path";

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
  override: z.optional(
    z.object({
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
    })
  ),
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

const scbase = new Map<string, string>();
for (const key of Object.keys(process.env)) {
  const val = process.env[key];
  if (val) scbase.set(key, val);
}

const zSettingObject = z.array(
  z.object({
    id: z.string(),
    path: z.string(),
    values: z.array(z.union([z.string(), z.array(z.string())])),
    platform: z.optional(z.string()),
    scope: zScope,
  })
);

type SettingObject = z.infer<typeof zSettingObject>;

export class Override implements Disposable {
  private subscriptions: Disposable[] = [];
  private hsp3root: string | undefined;
  private cfg = workspace.getConfiguration(EXTENSION_NAME);
  private sc = new Map<string, string>(scbase);
  private struct: SettingStruct | undefined;
  private log: LogWriter;

  constructor(
    private context: ExtensionContext,
    private agentMethods: Agent["method"]
  ) {
    this.log = new LogWriter("Override");

    this.subscriptions.push(
      commands.registerCommand("toolset-hsp3.override", () => {
        this.override();
      }),
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
      agentMethods.onDidChangeCurrent(() => {
        this.updateHsp3Root();
        const cfg = workspace.getConfiguration(EXTENSION_NAME);
        if (cfg.get("override.applyChangesImmediately")) this.override();
      }),
      extensions.onDidChange(() => this.override())
    );
  }

  dispose() {
    for (const item of this.subscriptions) item.dispose();
  }

  updateHsp3Root() {
    this.hsp3root = this.agentMethods.hsp3root();
    if (this.hsp3root) this.sc.set("HSP3_ROOT", this.hsp3root);
    else this.sc.delete("HSP3_ROOT");
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
    const reload = false;
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
        this.log.error(
          i18n.t("override.issue-with-listEx", {
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
      if (!data.json.override?.settings) return;
      if (data.json.override?.reloadWindow === true) reload = true;
      for (const elm of data.json.override.settings) {
        if (elm.platform && elm.platform !== os.platform()) continue;
        const keys = this.split.section_key(elm.id);
        if (!keys) {
          this.log.error(
            i18n.t("override.not-a-valid-setting-id", {
              extension_id: data.id,
              setting_id: elm.id,
            })
          );
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
        if ((configuration.override?.enable ?? false) === false) continue;
        // バージョン確認
        if (semver.valid(configuration.version)) {
          if (semver.satisfies(configuration.version, "1.x"))
            v1({ id: elm.id, json: elm.json["toolset-hsp3"] });
          else
            this.log.error(
              i18n.t(
                "override.not-support-static-config-version-of-extension",
                {
                  extension_id: elm.id,
                }
              )
            );
        }
      } else {
        this.log.error(
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
      if (error instanceof Error) this.log.error(error.message);
    }

    return {
      settings,
      reload,
    };
  }

  async override() {
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
        this.log.error(
          i18n.t("override.there-is-no-setting", { report: elm.report })
        );
        continue;
      }
      const value = path.join(...elm.value.map((word) => this.replace(word)));

      const write = async (item: Setting, value: string) => {
        if (cfg.inspect(item.key)?.globalValue !== value)
          await cfg
            .update(item.key, value, cfgTarget(item.scope))
            .then(undefined, (error: unknown) => {
              this.log.error(i18n.t("override.unknown-failed-to-override"), [
                `(${[item.section, item.key].join(".")})`,
                error instanceof Error ? error.message : String(error),
              ]);
            });
      };
      promises.push(write(elm, value));
    }

    // object override
    const objects = this.cfg.get<SettingObject>("override.objects");
    if (objects) {
      const result = zSettingObject.safeParse(objects);
      if (!result.success) {
        this.log.error("error zod parse.", [result.error.message]);
      }

      const target = workspace.getConfiguration(
        undefined,
        window.activeTextEditor?.document
      );
      const write = async (id: string, value: string, scope: TypedScope) => {
        target
          .update(id, value, cfgTarget(scope))
          .then(undefined, (reason: unknown) => {
            this.log.error(i18n.t("override.unknown-failed-to-override"), [
              reason instanceof Error ? reason.message : String(reason),
            ]);
          });
      };
      for (const obj of objects) {
        if (obj.platform && obj.platform !== os.platform()) continue;
        const prop1 = target.get<ProxyHandler<object>>(obj.id);
        const prop = JSON.parse(JSON.stringify(prop1));
        if (prop && typeof prop === "object") {
          const val = obj.values
            .map((elm) => {
              if (typeof elm === "string") return this.replace(elm);
              else return path.join(...elm.map((word) => this.replace(word)));
            })
            .join(" ");
          try {
            const value = docpath.setPath(prop, obj.path, val);
            promises.push(write(obj.id, value, obj.scope));
          } catch (reason) {
            this.log.error(i18n.t("override.unknown-failed-to-override"), [
              reason instanceof Error ? reason.message : String(reason),
            ]);
          }
        }
      }
    }

    await Promise.all(promises);

    // 書き換えた後、ウィンドウの再読み込みが必要なら再読み込みする。
    if (
      struct.reload ||
      this.cfg.get<boolean>("override.applyChangesImmediatelyInReloadWindow")
    ) {
      if (this.cfg.get<boolean>("override.showPopInfo")) {
        const buttonLabel_reload = i18n.t("reload");
        const reval = await window.showInformationMessage(
          i18n.t("reloadWindow"),
          buttonLabel_reload
        );
        if (reval === buttonLabel_reload)
          commands
            .executeCommand("workbench.action.reloadWindow")
            .then(undefined, (error) => {
              this.log.error(
                i18n.t("command_failed", {
                  command_name: "workbench.action.reloadWindow",
                }),
                error
              );
            });
      } else {
        commands
          .executeCommand("workbench.action.reloadWindow")
          .then(undefined, (error) => {
            this.log.error(
              i18n.t("command_failed", {
                command_name: "workbench.action.reloadWindow",
              }),
              error
            );
          });
      }
    }
  }
}
