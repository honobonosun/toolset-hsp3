import { exec } from "child_process";
import { glob } from "glob";
import isGlob = require("is-glob");
import { dirname, join, normalize } from "path";
import { promisify } from "util";
import {
  commands,
  Disposable,
  ExtensionContext,
  languages,
  LanguageStatusItem,
  OutputChannel,
  ProgressLocation,
  window,
  workspace,
  WorkspaceConfiguration,
} from "vscode";

const glob2 = promisify(glob);

export async function activate(context: ExtensionContext) {
  console.log(["active toolset-hsp3"]);

  const extension = new Extension(context);
  extension.update(true);
  return extension.api;
}
export function deactivate() {
  console.log(["close toolset-hsp3"]);
}

type Item = { path: string; dirname: string; version: string };

export class Extension implements Disposable {
  public config: WorkspaceConfiguration;
  public output: OutputChannel;
  public statusbar: LanguageStatusItem;
  public current: Item | undefined = undefined;
  public list: Item[] = [];

  constructor(private context: ExtensionContext) {
    context.subscriptions.push(this);
    this.config = workspace.getConfiguration("toolset-hsp3");
    context.subscriptions.push(
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("toolset-hsp3"))
          this.config = workspace.getConfiguration("toolset-hsp3");
        if (e.affectsConfiguration("toolset-hsp3.globs"))
          window.withProgress({ location: ProgressLocation.Window }, () =>
            this.update()
          );
      })
    );

    this.output = window.createOutputChannel("toolset-hsp3", "hsp3");
    context.subscriptions.push(this.output);

    this.statusbar = languages.createLanguageStatusItem(
      "toolset-hsp3.current",
      { language: "hsp3" }
    );
    this.statusbar.detail = "HSP バージョン";
    this.statusbar.command = {
      title: "バージョンの選択",
      command: "toolset-hsp3.select",
    };
    context.subscriptions.push(this.statusbar);

    context.subscriptions.push(
      commands.registerCommand("toolset-hsp3.select", async () => {
        const sel = await window.showQuickPick(
          this.list.map((val) => ({
            label: val.version,
            detail: val.path,
            item: val,
          }))
        );
        if (sel) this.select(sel.item);
      })
    );
  }

  dispose() {}

  public api = {
    current: this.current,
    list: this.list,
  };

  async hsp3cl(
    path: string
  ): Promise<{ err: any } | { result: { path: string; version: string } }> {
    const command = path;
    return promisify(exec)(command)
      .then((val) => {
        const r = val.stdout.match(/.+ver(\w+\.\w+)/);
        if (r && r[1]) return { result: { path, version: r[1] } };
        else
          return {
            err: Object.assign(new Error("Specify the path to hsp3cl."), {
              command,
            }),
          };
      })
      .catch((reason) => {
        const { stdout } = reason;
        if (typeof stdout === "string") {
          const r = stdout.match(/.+ver(\w+\.\w+)/);
          if (r && r[1]) return { result: { path, version: r[1] } };
          else return { err: reason };
        } else return { err: reason };
      });
  }

  async listing() {
    let result: Item[] = [];
    let errors: any[] = [];
    let patterns: Promise<string[]>[] = [];
    let paths: string[] = [];

    if (process.env.HSP3_ROOT)
      paths.push(join(process.env.HSP3_ROOT, "hsp3cl"));
    if (process.env.HSP3_HOME)
      paths.push(join(process.env.HSP3_HOME, "hsp3cl"));

    const globs = this.config.get<string[]>("globs") ?? [];

    if (0) {
      globs.forEach((pattern) => {
        if (isGlob(pattern)) patterns.push(glob2(pattern));
        else paths.push(pattern);
      });

      (await Promise.allSettled(patterns)).forEach((v) => {
        if (v.status === "fulfilled") paths.concat(v.value);
        else errors.push(v.reason);
      });
    }

    console.log(glob);

    globs.forEach(async (pattern) => {
      if (isGlob(pattern)) paths.concat(await glob2(pattern));
      else paths.push(pattern);
    });

    console.log(paths);

    paths = paths.map((el) => normalize(el));
    paths = paths.filter((el, i) => paths.indexOf(el) === i);

    console.log("p", paths);

    (await Promise.allSettled(paths.map((el) => this.hsp3cl(el)))).forEach(
      (v) => {
        if (v.status === "fulfilled")
          "result" in v.value
            ? result.push({
                path: v.value.result.path,
                dirname: dirname(v.value.result.path),
                version: v.value.result.version,
              })
            : errors.push(v.value.err);
      }
    );

    errors.forEach((el) => this.output.appendLine(el));
    if (errors.length > 0) this.output.show(true);

    return result;
  }

  draw() {
    if (this.current) {
      this.statusbar.text = this.current.version;
      if (this.statusbar.command)
        this.statusbar.command.tooltip = this.current.path;
    } else {
      this.statusbar.text = "none";
      if (this.statusbar.command) this.statusbar.command.tooltip = "none";
    }
  }

  findIndex(item: Item): number {
    return this.list.findIndex(
      (val) =>
        val.dirname === item.dirname &&
        val.path === item.path &&
        val.version === item.version
    );
  }

  load() {
    const sel = this.config.get<Item>("current");
    if (sel) {
      const index = this.findIndex(sel);
      if (index >= 0) {
        this.current = sel;
        this.draw();
      }
    }
  }

  async update(load: boolean = false) {
    this.list = (await this.listing()) ?? [];
    if (load) this.load();
  }

  select(item: Item) {
    if (this.findIndex(item) >= 0) this.current = item;
    else this.current = undefined;

    this.config.update("current", this.current);
    this.draw();
  }
}
