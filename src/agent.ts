import {
  Disposable,
  ExtensionContext,
  languages,
  window,
  LanguageStatusItem,
  commands,
  workspace,
  WorkspaceConfiguration,
  LanguageStatusSeverity,
} from "vscode";
import { promisify } from "node:util";
import { platform } from "node:os";
import { EXTENSION_NAME } from "./constant";
import glob = require("glob");
const pglob = promisify(glob);
import isGlob = require("is-glob");

type Item = {
  path: string;
  name: string;
};

interface Provider {
  name: string;
  resolve(patterns: string[]): Promise<{ errors: any[]; items: Item[] }>;
}

enum AgentStat {
  updateList = "updateList",
  updateCurrent = "updateCurrent",
}

type ListenerCallback = (stat: AgentStat) => void;

// 環境変数HSP3_ROOTから値を取り出す。
const get_hsp3roots = () => {
  if (!process.env.HSP3_ROOT) return [];
  if (platform() === "win32")
    return process.env.HSP3_ROOT.split(";").map((el) =>
      el.replace(/^[cC]:\\/, "/").replace(/\\/g, "/")
    );
  else return process.env.HSP3_ROOT.split(":");
};
const hsp3roots: string[] = get_hsp3roots();

export class Agent implements Disposable {
  private langStatBar: LanguageStatusItem;
  private listener = new Map<Symbol, ListenerCallback>();
  private providers = new Map<Symbol, Provider>();
  private current = {};
  private outcha: import("vscode").OutputChannel;
  private cfg: import("vscode").WorkspaceConfiguration;
  private hsp3dir: string | undefined;

  constructor(private context: ExtensionContext) {
    this.cfg = workspace.getConfiguration(EXTENSION_NAME);

    // UI
    this.langStatBar = languages.createLanguageStatusItem("toolset-hsp3", {
      language: "hsp3",
    });

    this.outcha = window.createOutputChannel("toolset-hsp3 agent", {
      log: true,
    });

    context.subscriptions.push(
      // config
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(EXTENSION_NAME))
          this.cfg = workspace.getConfiguration(EXTENSION_NAME);
      }),

      // command
      commands.registerCommand("toolset-hsp3.select", () => {}),
      commands.registerCommand("toolset-hsp3.unset", () => {}),
      commands.registerCommand("toolset-hsp3.open", () => {}),
      commands.registerCommand("toolset-hsp3.hsp3root", () => {}),
      commands.registerCommand("toolset-hsp3.override", () => {})
    );

    const current = context.workspaceState.get<Item>("toolset-hsp3.current");
    this.select(current);
  }

  public dispose() {
    this.listener.clear();
    this.langStatBar.dispose();
    this.outcha.dispose();
  }

  private writeLog(str: string) {
    this.outcha.appendLine(str);
    this.outcha.show();
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
  private notifyToListener(stat: AgentStat) {
    this.listener.forEach((callback) => {
      callback(stat);
    });
  }

  // ツールセットプロバイダーの登録
  private registryToolsetProvider(provider: Provider): Disposable {
    const symbol = Symbol();
    this.providers.set(symbol, provider);
    return {
      dispose: () => {
        this.providers.delete(symbol);
      },
    };
  }

  private async resolve(paths: string[]) {
    this.providers.forEach((val) => {
      val.resolve(paths);
    });
  }

  private listing() {
    const globs = (this.cfg.get("globs", []) as string[]).concat(hsp3roots);
    if (!globs) return;
  }

  reload() {}

  save(item: Item | undefined) {
    this.context.workspaceState.update("toolset-hsp3.current", item);
  }

  select(item: Item | undefined) {
    this.notifyToListener(AgentStat.updateCurrent);
  }

  update(item: Item | undefined) {
    let text: string;
    let chip: string | undefined;
    let severity: LanguageStatusSeverity;
    if (item) {
      text = item.name;
      chip = item.path;
      this.langStatBar.severity = LanguageStatusSeverity.Information;
    } else {
      text = "none";
      chip = undefined;
      this.langStatBar.severity = LanguageStatusSeverity.Warning;
    }
    this.langStatBar.text = text;
    this.langStatBar.detail = chip;
  }

  async showSelect() {}

  get hsp3root() {
    return this.current;
  }

  // 公開メソッド
  public method = {
    current: () => {},
    list: () => {},
    select: () => {},
    listen: (callback: ListenerCallback) => this.listen(callback),
    registryToolsetProvider: (provider: Provider) =>
      this.registryToolsetProvider(provider),
  };
}
