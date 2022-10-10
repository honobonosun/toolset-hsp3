import {
  commands,
  Disposable,
  ExtensionContext,
  languages,
  LanguageStatusItem,
  window,
  workspace,
} from "vscode";
import { promisify } from "node:util";
import { glob } from "glob";
import isGlob = require("is-glob");
import Registry from "./registry";
import { exec } from "node:child_process";
import { join, dirname } from "node:path";
import { stat } from "node:fs/promises";

const pglob = promisify(glob);

type Item = { name: string; path: string };

interface Provider {
  dispose(): void;
  resolve(patterns: string[]): Promise<{ errors: any[]; items: Item[] }>;
}

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
    if ((await stat(path)).isDirectory()) cmd = join(path, "hsp3cl.exe");
    exec(cmd, (error, stdout) => {
      const r = stdout.match(/ver(.*?) /);
      if (r && r[1]) resolve({ path, version: r[1] });
      else resolve({ error });
    });
  });

const provider = {
  dispose() {},
  async resolve(patterns: string[]) {
    let paths = [] as string[];
    let errors = [] as any[];
    let items = [] as Item[];
    (await Promise.allSettled(patterns.map((el) => pglob(el)))).forEach((v) => {
      if (v.status === "fulfilled") paths = paths.concat(v.value);
      else errors.push(v.reason);
    });
    for (const el of paths) {
      const result = await hsp3clVersion(el);
      if ("error" in result) errors.push(result.error);
      else items.push({ path: el, name: result.version });
    }
    return { errors, items };
  },
};

export function activate(context: ExtensionContext) {
  console.log("activate toolset-hsp3");

  const extension = new Extension(context);
  context.subscriptions.push(extension);
  context.subscriptions.push(
    commands.registerCommand(
      "toolset-hsp3.select",
      extension.showSelect,
      extension
    )
  );
  context.subscriptions.push(
    commands.registerCommand("toolset-hsp3.current", async (mode) => {
      if (mode.raw) return extension.methods.current();
      else if (mode.path) return extension.methods.current()?.path;
      else if (mode.name) return extension.methods.current()?.name;
      else {
        const path = extension.methods.current()?.path;
        if (!path) return undefined;
        if ((await stat(path)).isDirectory()) return path;
        else return dirname(path);
      }
    })
  );
  context.subscriptions.push(
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("toolset-hsp3.globs")) extension.countup();
    })
  );
  extension.methods.registryToolsetProvider("hsp3cl", provider);
  const cfg = workspace.getConfiguration("toolset-hsp3");
  const cur = cfg.get("current", undefined) as Item | undefined;
  console.log(cur);
  if (cur) extension.select(cur);
  return extension.methods;
}

export function deactivate() {
  console.log("deactivate toolset-hsp3");
}

class Extension implements Disposable {
  private langstatbar;
  private registry;
  private count = { cur: Symbol(), cnt: Symbol() };
  private items = undefined as Item[] | undefined;
  private current = undefined as Item | undefined;
  private output = window.createOutputChannel("toolset-hsp3", "hsp3");

  constructor(private context: ExtensionContext) {
    this.langstatbar = languages.createLanguageStatusItem(
      "toolset-hsp3.current",
      { language: "hsp3" }
    );
    this.langstatbar.text = "text";
    this.langstatbar.detail = "current hsp3root";
    this.langstatbar.command = {
      command: "toolset-hsp3.select",
      title: "Select",
    };

    this.registry = {
      toolsetProvider: new Registry<Provider>(),
    };
  }

  dispose() {
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
  };

  countup() {
    this.count.cnt = Symbol();
  }

  async listing() {
    if (this.count.cur === this.count.cnt) return this.items;

    let errors = [] as any[];
    let items = [] as Item[];
    const config = workspace.getConfiguration("toolset-hsp3");
    const globs = (config.get("globs", []) as string[]).concat(hsp3roots);

    for (const key of this.registry.toolsetProvider.keys()) {
      const el = this.registry.toolsetProvider.value(key);
      if (!el) continue;
      const result = await el.resolve(globs);
      errors = errors.concat(result.errors);
      items = items.concat(result.items);
    }
    errors.forEach((el) => {
      //const date = new Date();
      const message = `${el.message}`;
      this.output.appendLine(message);
    });
    this.count.cur = this.count.cnt;
    this.items = items;
    return items;
  }

  async update() {
    if (this.current) {
      this.langstatbar.text = this.current.name;
      if (this.langstatbar.command)
        this.langstatbar.command.tooltip = this.current.path;
    } else {
      this.langstatbar.text = "none";
      if (this.langstatbar.command)
        this.langstatbar.command.tooltip = undefined;
    }
  }

  async select(item: Item) {
    this.current = item;
    const cfg = workspace.getConfiguration("toolset-hsp3");
    cfg.update("current", item);

    this.update();
  }

  async showSelect() {
    const fn = async () => {
      const description = (path: string) => {
        for (const el of hsp3roots) if (el === path) return "$env:HSP3_ROOT";
        return undefined;
      };

      const items = await this.listing();
      if (!items) return [];
      return items.map((el) => ({
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
