import {
  commands,
  Disposable,
  ExtensionContext,
  l10n,
  languages,
  LanguageStatusSeverity,
  ShellExecution,
  Task,
  tasks,
  TaskScope,
  window,
  workspace,
} from "vscode";
import { promisify } from "node:util";
import { glob } from "glob";
import { execFile } from "node:child_process";
import { join, dirname, normalize } from "node:path";
import { stat } from "node:fs/promises";
import { platform } from "node:os";
import Registry from "./registry";
import { Override } from "./override";
import { EXTENSION_NAME } from "./constant";

const pglob = promisify(glob);

type Item = { name: string; path: string };

interface Provider {
  dispose(): void;
  resolve(patterns: string[]): Promise<{ errors: any[]; items: Item[] }>;
}

// win32専用
const env_hsp3root = () => {
  if (process.env.HSP3_ROOT)
    return process.env.HSP3_ROOT.split(";").map((el) =>
      el.replace(/[cC]:\\/, "/").replace(/\\/g, "/")
    );
  else return [];
};
const hsp3roots = env_hsp3root();

const hsp3clVersion = (
  path: string
): Promise<{ path: string; version: string } | { error: any }> =>
  new Promise(async (resolve, reject) => {
    let cmd = path;
    if ((await stat(path)).isDirectory()) {
      cmd = join(path, "hsp3cl");
      try {
        await stat(cmd);
      } catch (e) {
        cmd += ".exe";
      }
    }
    execFile(cmd, (error, stdout) => {
      const r = stdout.match(/ver(.*?) /);
      if (r && r[1]) resolve({ path: cmd, version: r[1] });
      else resolve({ error });
    });
  });

const provider = {
  dispose() {},
  async resolve(paths: string[]) {
    let errors = [] as any[];
    let items = [] as Item[];

    for (const el of paths) {
      const result = await hsp3clVersion(el);
      if ("error" in result) errors.push(result.error);
      else items.push({ path: result.path, name: result.version });
    }
    return { errors, items };
  },
};

export function activate(context: ExtensionContext) {
  //console.log("activate toolset-hsp3");

  const extension = new Extension(context);
  const override = new Override(context, extension.methods);
  context.subscriptions.push(extension, override);

  // command
  context.subscriptions.push(
    commands.registerCommand(
      "toolset-hsp3.select",
      extension.showSelect,
      extension
    ),
    commands.registerCommand("toolset-hsp3.current", async (mode) => {
      if (Array.isArray(mode) && mode[0] === "${command:toolset-hsp3.current}")
        return await extension.methods.hsp3dir();
      return mode === undefined
        ? await extension.methods.hsp3dir()
        : extension.methods.current();
    }),
    commands.registerCommand("toolset-hsp3.current.toString", () =>
      extension.methods.hsp3dir()
    ),
    commands.registerCommand("toolset-hsp3.open", async () => {
      const hsp3dir = await extension.methods.hsp3dir();
      if (!hsp3dir) return;
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
      })(hsp3dir);
      tasks.executeTask(
        new Task(
          { type: "shell", command, cwd: hsp3dir },
          TaskScope.Workspace,
          "open hsp3root",
          "toolset-hsp3.taskrunner",
          new ShellExecution(command, { cwd: hsp3dir })
        )
      );
    }),
    commands.registerCommand("toolset-hsp3.override", () => {
      override.override();
    }),
    commands.registerCommand("toolset-hsp3.unset", () => {
      extension.select(undefined);
    })
  );

  // config
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("toolset-hsp3.globs")) extension.countup();
    })
  );

  // setup
  extension.methods.registryToolsetProvider("hsp3cl", provider);

  const cur = context.workspaceState.get("current") as Item | undefined;
  extension.select(cur);

  return extension.methods;
}

export function deactivate() {
  //console.log("deactivate toolset-hsp3");
}

export class Extension implements Disposable {
  private langstatbar;
  private registry;
  private count = { cur: Symbol(), cnt: Symbol() };
  private items = undefined as Item[] | undefined;
  private current = undefined as Item | undefined;
  private output = window.createOutputChannel("toolset-hsp3");

  constructor(private context: ExtensionContext) {
    this.langstatbar = languages.createLanguageStatusItem(
      "toolset-hsp3.current",
      { language: "hsp3" }
    );
    this.langstatbar.text = "none";
    this.langstatbar.detail = "current hsp3root";
    this.langstatbar.command = {
      command: "toolset-hsp3.select",
      title: "Select",
    };

    this.registry = {
      toolsetProvider: new Registry<Provider>(),
      listener: new Map<Symbol, (cur: Item | undefined) => void>(),
    };
  }

  dispose() {
    this.langstatbar.dispose();
    this.output.dispose();
  }

  methods = {
    showSelect: this.showSelect,
    registryToolsetProvider: (name: string, provider: Provider) => {
      this.countup();
      this.registry.toolsetProvider.register(name, provider);
      return {
        dispose: () => this.registry.toolsetProvider.delete(name),
      };
    },
    current: () => this.current,
    hsp3dir: async () => {
      if (!this.current?.path) return undefined;
      const path = this.current.path;
      if ((await stat(path)).isDirectory()) return path;
      else return dirname(path);
    },
    onDidChangeCurrent: (callback: (cur: Item | undefined) => void) => {
      const symbol = Symbol();
      this.registry.listener.set(symbol, (cur) => callback(cur));
      return {
        dispose: () => {
          this.registry.listener.delete(symbol);
        },
      };
    },
  };

  countup() {
    this.count.cnt = Symbol();
  }

  async listing() {
    if (this.count.cur === this.count.cnt) return this.items;

    this.langstatbar.busy = true;
    let items = [] as Item[];
    try {
      let paths = [] as string[];
      let errors = [] as any[];

      const config = workspace.getConfiguration("toolset-hsp3");
      const globs = (config.get("globs", []) as string[]).concat(hsp3roots);

      (await Promise.allSettled(globs.map((el) => pglob(el)))).forEach((v) => {
        if (v.status === "fulfilled") paths = paths.concat(v.value);
        else errors.push(v.reason);
      });
      paths = paths.map((el) => normalize(el));

      for (const key of this.registry.toolsetProvider.keys()) {
        const el = this.registry.toolsetProvider.value(key);
        if (!el) continue;
        const result = await el.resolve(paths);
        errors = errors.concat(result.errors);
        items = items.concat(result.items);
      }
      if (errors.length > 0) {
        this.output.appendLine("# Toolset Provider Log");
        errors.forEach((el) => this.output.appendLine(el.toString()));
      }
      this.count.cur = this.count.cnt;
      this.items = items;
    } catch (error) {
      const err = error as Error;
      this.output.appendLine("# Toolset Provider Panic Log");
      this.output.appendLine(err.message);
      if (err.stack) this.output.appendLine(err.stack);
      this.output.show(true);
    } finally {
      this.langstatbar.busy = false;
    }

    return items;
  }

  async update() {
    if (this.current) {
      // 言語ステータスバー 更新
      this.langstatbar.text = this.current.name;
      if (this.langstatbar.command)
        this.langstatbar.command.tooltip = this.current.path;
      this.langstatbar.severity = LanguageStatusSeverity.Information;

      // ターミナル環境変数 更新
      const cfg = workspace.getConfiguration(EXTENSION_NAME);
      if (cfg.get("task.env.enable") === true) {
        this.context.environmentVariableCollection.clear();
        this.context.environmentVariableCollection.replace(
          "HSP3_ROOT",
          dirname(this.current.path)
        );
        /*  // オプション：PATH変数にhsp3rootを通す
        this.context.environmentVariableCollection.append(
          "PATH",
          `${platform() === "win32" ? ";" : ":"}${dirname(this.current.path)}`
        );
        */
      }
    } else {
      // 言語ステータスバー 更新
      this.langstatbar.text = "none";
      if (this.langstatbar.command)
        this.langstatbar.command.tooltip = undefined;
      this.langstatbar.severity = LanguageStatusSeverity.Warning;

      // ターミナル環境変数 更新
      this.context.environmentVariableCollection.clear();
    }
  }

  async select(item: Item | undefined) {
    this.current = item;

    // 拡張機能のストレージに保存する
    this.context.workspaceState.update("current", item);

    // リスナーへ通知
    this.registry.listener.forEach((el) => el(this.current));

    // 画面表示を反映させる
    this.update();
  }

  async showSelect() {
    const fn = async () => {
      const description = (path: string) => {
        if (platform() === "win32")
          for (const el of hsp3roots.map((el) =>
            normalize(el).replace(/^\//, "C:\\")
          ))
            if (el === dirname(path)) return "$env:HSP3_ROOT";
        return undefined;
      };

      const list = await this.listing();
      if (!list) return [];
      else
        return Array.from(
          new Map(list.map((elm) => [elm.path, elm])).values()
        ).map((el) => ({
          label: el.name,
          detail: el.path,
          item: el,
          description: description(el.path),
        }));
    };
    const sel = await window.showQuickPick(fn());
    if (sel) this.select(sel.item);
  }
}