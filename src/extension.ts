import * as vscode from "vscode";
import * as cp from "child_process";
import os = require("os");
import path = require("path");
import * as glob from "glob";
import isGlob = require("is-glob");
import mu from "./myUtil";
import Register from "./register";
import Lancher from "./launcher";

export function activate(context: vscode.ExtensionContext) {
  mu.devmode = context.extensionMode === vscode.ExtensionMode.Development;
  mu.log('Congratulations, your extension "toolset-hsp3" is now active!');
  const extension = new Extension();
  context.subscriptions.push(extension);
  return extension.exportAPIs();
}

export function deactivate() {}

type Item = { title: string; path: string; kind?: string };

export class Extension implements vscode.Disposable {
  cfg: vscode.WorkspaceConfiguration;
  subscriptions: vscode.Disposable[] = [];
  statusbar: vscode.StatusBarItem;
  list: Item[] = [];
  current: Item | undefined;

  private provider = new Register<string[]>();
  private listener = {
    change: new Register<void>(),
    list: new Register<void>(),
  };

  constructor() {
    // Provider
    this.subscriptions.push(this.provider);
    // launcher
    this.subscriptions.push(new Lancher(this));

    // load config
    this.cfg = vscode.workspace.getConfiguration("toolset-hsp3");
    this.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("toolset-hsp3")) {
          this.cfg = vscode.workspace.getConfiguration("toolset-hsp3");
          if (e.affectsConfiguration("toolset-hsp3.paths.search"))
            this.update((list) => {
              if (!list.some((v) => v.path === this.current?.path))
                this.select();
            });
        }
      })
    );

    // register command
    this.subscriptions.push(
      vscode.commands.registerCommand("toolset-hsp3.select", () => {
        this.showQuickPick();
      })
    );

    // statusbar
    this.statusbar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right
    );
    this.statusbar.command = "toolset-hsp3.select";
    this.statusbar.text = "none";
    this.subscriptions.push(this.statusbar);

    this.update((list) => {
      if (list.length === 0) return;
      const path = this.cfg.get("path.index");
      if (path) this.select(list.find((v) => v.path === path));
    });

    // textEditor
    if (vscode.window.activeTextEditor?.document.languageId === "hsp3")
      this.statusbar.show();
    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document.languageId === "hsp3") this.statusbar.show();
        else this.statusbar.hide();
      })
    );
  }

  dispose() {
    this.subscriptions.forEach((e) => e.dispose());
  }

  // 複数のspawnを同時進行しない実装なので遅い（Wineだと更に遅い）
  async listing() {
    let paths: string[] = [];

    // toolset-hsp3.paths.searchのパスパターンを取得
    let patterns: string[] = [];
    (<string[]>this.cfg.get("paths.search") || []).forEach((v) => {
      if (isGlob(v)) patterns.push(v);
      else paths.push(v);
    });

    // registerToolsetProviderからパスパターンを取得
    (await Promise.allSettled(this.provider.send())).forEach((v) => {
      if (v.status === "fulfilled")
        v.value.forEach((el) => {
          if (isGlob(el)) patterns.push(el);
          else paths.push(el);
        });
    });

    // ダブりを削除
    patterns = patterns.filter((el, i) => patterns.indexOf(el) === i);
    mu.log("toolset-hsp3 glob patterns", patterns);

    // globでパターン検索
    const matches = await Promise.allSettled(patterns.map((v) => mu.glob2(v)));
    matches.forEach((v) => {
      if (v.status === "fulfilled") paths = paths.concat(v.value);
    });

    // リスト生成
    mu.log("toolset-hsp3 check paths", paths);
    let items: Item[] = [];
    for (const v of paths) {
      mu.log("name check", path.parse(v).name);
      if (path.parse(v).name === "hsp3cl") {
        const kind = path.extname(v) === ".exe" ? "win32" : "!win32";
        const useWine = this.cfg.get<boolean>("useWine") ?? false;
        const useWSL = this.cfg.get<boolean>("useWSL") ?? false;
        const r = await mu.hsp3clVersion(v, useWine, useWSL);

        if ("err" in r) {
          mu.log(os.platform(), r.err);
          vscode.window.showWarningMessage(mu.errMsg(r.err) + ' : "' + v + '"');
        } else
          items.push({
            title: r.version,
            path: v,
            kind,
          });
      }
    }
    return items;
  }

  async update(cb?: (list: Item[]) => void): Promise<void> {
    this.list = await this.listing();
    if (this.list.length === 0) {
      this.select();
      if (
        (await vscode.window.showErrorMessage(
          "toolset-hsp3.paths.search is not set. At least one more valid node-glob pattern is required.",
          "Opne the setting"
        )) === "Opne the setting"
      )
        vscode.commands.executeCommand(
          "workbench.action.openSettings2",
          "toolset-hsp3.paths.search"
        );

      return;
    }
    if (cb) cb(this.list);
    this.listener.list.send(this.list);
  }

  select(item?: Item, save?: boolean): void {
    if (!item) {
      this.current = undefined;
      this.statusbar.text = "none";
      this.statusbar.tooltip = undefined;
    } else {
      // FIXME : 値をチェック無しで適用している
      this.current = item;
      this.statusbar.text = this.current.title;
      this.statusbar.tooltip = this.current.path;
    }
    if (save)
      this.cfg.update(
        "path.index",
        this.current?.path || null,
        this.cfg.get("path.globalSave") === false ? undefined : true
      );
    this.listener.change.send(this.current);
  }

  async showQuickPick(filter?: (item: Item) => boolean): Promise<void> {
    const list = filter ? this.list.filter(filter) : this.list;
    const r = await vscode.window.showQuickPick(
      list.map((v) => ({ label: v.title, detail: v.path }))
    );
    if (r) this.select({ title: r.label, path: r.detail }, true);
  }

  exportAPIs() {
    const current = () => this.current;
    const select = (item: Item) => this.select(item);
    const list = () => this.list;
    const update = () => this.update();
    const quickPick = (filter?: (item: Item) => boolean) =>
      this.showQuickPick(filter);
    const registerProvider = (fn: () => Promise<string[]>) =>
      this.provider.registerListener(fn);
    const onDidChangeCurrent = (fn: (current: Item) => void) =>
      this.listener.change.registerListener(fn);
    const onDidChangeToolsetList = (fn: (list: Item[]) => void) =>
      this.listener.list.registerListener(fn);
    return {
      current,
      select,
      list,
      update,
      quickPick,
      registerProvider,
      onDidChangeCurrent,
      onDidChangeToolsetList,
    };
  }
}

/*
toolset-hsp3
hsp3rootの切り替え機能を提供する

launcher-hsp3
hsp3開発者ツールの呼び出しを提供する

language-hsp3
構文の色分けと解析を行う。
構文解析器ができ次第、詳細な色分けと入力補助を実装する。

hsp3dish-hsp3
dishをvscodeのwebviewで実行する。

guide-hsp3
helpman-hsp3

*/
