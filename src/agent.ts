import { platform } from "node:os";
import { promisify } from "node:util";
import {
  Disposable,
  ExtensionContext,
  LanguageStatusItem,
  LanguageStatusSeverity,
  commands,
  languages,
  window,
  workspace,
} from "vscode";
import { EXTENSION_NAME } from "./constant";
import { i18n } from "./i18n";
import { LogWriter } from "./log";
import glob = require("glob");
const pglob = promisify(glob);
import path = require("node:path");

export class NotInListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotInListError";
  }
}

export type AgentItem = {
  path: string;
  name: string;
};

export type resolutionResult = Promise<
  { errors: unknown[]; items: AgentItem[] } | undefined
>;

export interface AgentProvider {
  name: string;
  resolve(patterns: string[]): resolutionResult;
}

export enum AgentState {
  updateList = "updateList",
  updateCurrent = "updateCurrent",
}

type ListenerCallback = (state: AgentState) => void;

// 環境変数HSP3_ROOTから値を取り出す。
const get_hsp3roots = () => {
  if (!process.env.HSP3_ROOT) return [];
  if (platform() === "win32") return process.env.HSP3_ROOT.split(";");
  else return process.env.HSP3_ROOT.split(":");
};
const hsp3roots: string[] = get_hsp3roots().map((elm) => path.normalize(elm));

// Win環境のパス表記をnode-globの仕様に変換する。
const escapeWinGlob = (word: string) =>
  word.replace(/^[cC]:\\/, "/").replace(/\\/g, "/");

export class Agent implements Disposable {
  private langStatBar: LangStatBar;
  private listener = new Map<symbol, ListenerCallback>();
  private providers = new Map<symbol, AgentProvider>();
  private current: AgentItem | undefined;
  private log: LogWriter;
  private cfg: import("vscode").WorkspaceConfiguration;
  private cache: AgentItem[] | undefined;

  constructor(private context: ExtensionContext) {
    this.cfg = workspace.getConfiguration(EXTENSION_NAME);

    // UI
    this.langStatBar = new LangStatBar();
    this.log = new LogWriter("Agent");

    context.subscriptions.push(
      // config
      workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration(EXTENSION_NAME)) {
          this.cfg = workspace.getConfiguration(EXTENSION_NAME);
          if (e.affectsConfiguration("toolset-hsp3.globs")) this.refresh();
        }
      }),
      // command
      commands.registerCommand("toolset-hsp3.select", () => this.showSelect()),
      commands.registerCommand("toolset-hsp3.unset", () => {
        this.select(undefined);
        this.refresh();
        window.showInformationMessage(i18n.t("agent.hsp3root-unselected"));
      }),
      commands.registerCommand("toolset-hsp3.hsp3root", () => this.hsp3root),
      commands.registerCommand(
        "toolset-hsp3.current.toString",
        () => this.hsp3root
      )
    );
  }

  public dispose() {
    this.listener.clear();
    this.langStatBar.dispose();
  }

  // エージェント変化をcallback関数で購読できるようにする。
  private listen(callback: ListenerCallback): Disposable {
    const symbol = Symbol();
    this.listener.set(symbol, callback);
    return {
      dispose: () => {
        this.listener.delete(symbol);
      },
    };
  }

  // エージェント変化を購読者へ通知する。
  private notifyToListener(stat: AgentState) {
    this.listener.forEach((callback) => {
      callback(stat);
    });
  }

  // ツールセットプロバイダーの登録
  private registryToolsetProvider(provider: AgentProvider): Disposable {
    this.log.info(i18n.t("agent.registry-provider", { name: provider.name }));
    const symbol = Symbol();
    this.providers.set(symbol, provider);
    return {
      dispose: () => {
        this.providers.delete(symbol);
      },
    };
  }

  // glob解析後のpathをproviderへ渡してItemを取得する。
  private async resolve(paths: string[]) {
    let list: AgentItem[] = [];
    for (const provider of this.providers) {
      const name = provider[1].name;
      const resolve = provider[1].resolve;
      const result = await resolve(paths).then(undefined, (reason) => {
        if (reason instanceof Error)
          this.log.error(
            i18n.t("agent.resolution-method-call-error", {
              name,
              message: reason.message,
            })
            /*`Resolution Method Call Error [${name}] "${reason.message}"`*/
          );
        else this.log.error("Resolution Method Call Error", [name, reason]);
      });
      if (result) {
        list = list.concat(result.items);
        for (const reason of result.errors)
          if (reason instanceof Error)
            this.log.error(
              i18n.t("agent.resolution-error-name-reason-message", {
                name,
                message: reason.message,
              })
              /*`Resolution Error [${name}] "${reason.message}"`*/
            );
          else this.log.error("Resolution Error", [name, reason]);
      }
    }
    return list;
  }

  public async listing() {
    if (this.cache?.length ?? 0 > 0) return this.cache;

    this.langStatBar.busy = true;
    try {
      let paths: string[] = [];

      // globパターンを求める
      const globPatterns = (this.cfg.get("globs", []) as string[]).concat(
        hsp3roots
      );
      if (!globPatterns) {
        this.log.error(i18n.t("agent.globs-config-is-not-valid"));
        return;
      }

      // globする
      const globbing = globPatterns.map((val) => pglob(escapeWinGlob(val)));
      const globResult = await Promise.allSettled(globbing);
      for (const el of globResult) {
        if (el.status === "fulfilled") paths = paths.concat(el.value);
        else {
          if (el.reason instanceof Error)
            this.log.error(`globs error [${el.reason.message}]`);
          else console.error(el.reason);
        }
      }
      paths = paths.map((el) => path.normalize(el));

      // プロバイダーで解決する
      const resolutionResult = await this.resolve(paths);

      this.cache = resolutionResult;
    } catch (error) {
      if (error instanceof Error)
        this.log.error(`LISTING ERROR : "${error.message}"`);
      else console.error("LISTING", error);
    } finally {
      this.langStatBar.busy = false;
    }

    return this.cache;
  }

  async refresh() {
    this.cache = undefined;
    this.cache = await this.listing();
  }

  inCache(item: AgentItem) {
    if (!this.cache) throw new Error("no cache data.");
    for (const elm of this.cache)
      if (elm.name === item.name && elm.path == item.path) return true;
    return false;
  }

  // workspaceStateから前回の状態に復元する。
  async load() {
    // 現在の検索結果を得る
    if (!this.cache) await this.listing();

    // 現在のワークスペースから最後に選択したhsp3rootを思い出す。
    let current = this.context.workspaceState.get<AgentItem>(
      "toolset-hsp3.current"
    );

    // 思い出したhsp3rootが、現在の検索結果にあるか。
    if (current && !this.inCache(current)) current = undefined; // 無ければ無効化

    // `VSCODE_HSP3ROOT_PRIORITY`環境変数があれば、HSP3_ROOT環境変数の自動適用を優先する。
    const priority = process.env["VSCODE_HSP3ROOT_PRIORITY"];
    if (priority?.toLowerCase() === "true" || priority === "1")
      current = undefined;

    if (!this.cache) {
      current = undefined; // 検索結果が無ければ、hsp3rootは未選択にする。
    } else if (
      !current &&
      this.cfg.get<boolean>("agent.autoChoice.enable", true)
    ) {
      // 思い出しても未選択ならば、HSP3_ROOT環境変数から探す。
      for (const hsp3root of hsp3roots) {
        for (const elm of this.cache) {
          if (hsp3root === path.dirname(elm.path)) {
            current = elm;
            break;
          }
        }
        if (current) break;
      }

      // HSP3_ROOT環境変数から合致するパスが見つかったら。
      if (current) {
        // ワークスペース設定に保存する。
        this.save(current);

        // 自動選択したことを通知する。
        this.log.info(i18n.t("agent.auto-choice"), [
          `name : ${current.name}`,
          `path : ${current.path}`,
        ]);
        if (this.cfg.get<boolean>("agent.autoChoice.showPopInfo")) {
          const buttonLabel_reselection = i18n.t("reselection");
          window
            .showInformationMessage(
              i18n.t("agent.auto-choice"),
              buttonLabel_reselection
            )
            .then((val) => {
              if (val === buttonLabel_reselection)
                commands
                  .executeCommand("toolset-hsp3.select")
                  .then(undefined, (reason) =>
                    this.log.error("Command failed.", [reason])
                  );
            });
        }
      }
    }

    this.current = current;
    this.update();
    return this.current;
  }

  // workspaceStateに現在の状態を保存する。
  private save(item: AgentItem | undefined) {
    this.context.workspaceState.update("toolset-hsp3.current", item);
  }

  select(item: AgentItem | undefined) {
    if (item && !this.inCache(item))
      throw new NotInListError("You cannot select items that are not listed.");
    this.current = item;
    this.save(item);
    this.notifyToListener(AgentState.updateCurrent);
    this.update();
  }

  update() {
    this.langStatBar.update(this.current);
  }

  async showSelect() {
    const fn = async () => {
      const list = await this.listing();
      if (!list) return [];

      const description = (longname: string) => {
        if (hsp3roots.indexOf(path.dirname(longname)) > -1) return "HSP3_ROOT";
        else return undefined;
      };

      return Array.from(
        new Map(list.map((elm) => [elm.path, elm])).values()
      ).map((el) => ({
        label: el.name,
        detail: el.path,
        item: el,
        description: description(el.path),
      }));
    };
    const selectItem = await window.showQuickPick(fn());
    if (selectItem) this.select(selectItem?.item);
  }

  get hsp3root() {
    if (this.current) return path.dirname(this.current.path);
    else return undefined;
  }

  // 公開メソッド
  public readonly method = {
    current: () => this.current,
    hsp3root: () => this.hsp3root,
    listen: (callback: ListenerCallback) => this.listen(callback),
    registryToolsetProvider: (provider: AgentProvider) =>
      this.registryToolsetProvider(provider),
    refresh: () => this.refresh(),
    // v0.x 互換用
    onDidChangeCurrent: (
      callback: (cur: AgentItem | undefined) => void
    ): Disposable => {
      return this.listen((status) => {
        if (status === AgentState.updateCurrent) callback(this.current);
      });
    },
  };
}

class LangStatBar implements Disposable {
  statItem: LanguageStatusItem;
  constructor() {
    this.statItem = languages.createLanguageStatusItem(
      "toolset-hsp3.hsp3root",
      {
        language: "hsp3",
      }
    );
    this.statItem.text = "Initializing";
    this.busy = true;
    this.statItem.detail = "Current hsp3root";
    this.statItem.command = {
      command: "toolset-hsp3.select",
      title: "Select",
    };
  }

  dispose() {
    this.statItem.dispose();
  }

  set busy(val: boolean) {
    if (this.statItem.busy !== val) this.statItem.busy = val;
  }

  update(item: AgentItem | undefined) {
    if (item) {
      this.statItem.text = item.name;
      if (this.statItem.command) this.statItem.command.tooltip = item.path;
      this.statItem.severity = LanguageStatusSeverity.Information;
    } else {
      this.statItem.text = "none";
      if (this.statItem.command) this.statItem.command.tooltip = undefined;
      this.statItem.severity = LanguageStatusSeverity.Warning;
    }
  }
}
