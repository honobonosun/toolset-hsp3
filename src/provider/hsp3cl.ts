/* eslint-disable @typescript-eslint/naming-convention */
import { glob } from "glob";
import isGlob = require("is-glob");
import { dirname, extname, normalize, parse } from "path";
import { promisify } from "util";
import { Disposable } from "vscode";
import { Extension, Item, Provider } from "../extension";
import mu from "../myUtil";

export default class Hsp3clProvider implements Provider {
  static loadenv(
    patterns: Array<string>,
    paths: Array<string>,
    target: string | undefined
  ): void {
    if (typeof target === "string" && target.length > 0)
      if (isGlob(target)) patterns.push(target);
      else paths.push(target);
    return;
  }

  subscriptions: Disposable[] = [];
  cache = new Map();

  constructor(private extension: Extension) {
    mu.log(Hsp3clProvider.name);

    /* extension側でupdateされないなら自分からupdateを呼ぶ必要があります。
    this.subscriptions.push(
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("toolset-hsp3.hsp3cl.globs"))
          extension.update();
      })
    );
    */
  }

  dispose() {
    this.subscriptions.forEach((el) => el.dispose());
  }

  public languageId = ["hsp3"];

  public async provideToolset(): Promise<Item[] | undefined> {
    let patterns: string[] = [];
    let paths: string[] = [];
    const items: Item[] = [];
    const useWine = this.extension.config.get<boolean>("launch.useWine", false);
    const useWSL = this.extension.config.get<boolean>("launch.useWSL", false);

    // load env
    const { HSP3_ROOT, HSP3_HOME } = process.env;
    Hsp3clProvider.loadenv(patterns, paths, HSP3_ROOT);
    Hsp3clProvider.loadenv(patterns, paths, HSP3_HOME);

    // load config
    (this.extension.config.get<string[]>("hsp3cl.globs") ?? []).forEach(
      (el) => {
        if (el.length > 0) {
          el = mu.normalize(el, {});
          if (isGlob(el)) patterns.push(el);
          else paths.push(el);
        }
      }
    );

    patterns = patterns.filter((el, i) => patterns.indexOf(el) === i);

    // glob
    const globs = patterns.map((el) => promisify(glob)(el));
    (await Promise.allSettled(globs)).forEach((v) => {
      if (v.status === "fulfilled") paths = paths.concat(v.value);
      else {
        console.error([Hsp3clProvider.name, v.reason]);
        this.extension.output.appendLine(
          `[${Hsp3clProvider.name}] ${(v.reason as Error).message}`
        );
        this.extension.output.show(true);
      }
    });

    // 重複を削除
    paths = paths.map((val) => normalize(val));
    paths = paths.filter((el, i) => paths.indexOf(el) === i);

    // get hsp3cl version
    // eslint-disable-next-line curly
    for (const el of paths) {
      if (this.cache.has(el)) {
        items.push(this.cache.get(el));
        continue;
      }
      if (parse(el).name === "hsp3cl") {
        const kind =
          extname(el) === ".exe" ? ["hsp3cl", "win32"] : ["hsp3cl", "!win32"];
        const r = await mu.hsp3clVersion(el, useWine, useWSL);
        if ("err" in r) {
          console.error([Hsp3clProvider.name, r.err]);
          const err = r.err;
          const msg = /^Command failed/.test(err.message)
            ? `"${(err as any).cmd}" was not executable.`
            : `${err.message} : "${el}"`;
          this.extension.output.appendLine(`[${Hsp3clProvider.name}] ${msg}`);
          this.extension.output.show(true);
        } else
          items.push({
            name: r.version,
            path: el,
            dir: dirname(el),
            kind,
          });
      }
    }

    this.cache.clear();
    for (const el of items) this.cache.set(el.path, el);

    if (items.length > 0) return items;
    else return undefined;
  }

  public resolveTaskEnv(item: Item) {
    return {
      HSP3_ROOT: item.dir,
      HSP3_HOME: item.dir,
      PATH: item.dir,
    };
  }
}
