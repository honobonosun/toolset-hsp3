import {
  commands,
  Disposable,
  ExtensionContext,
  ExtensionMode,
  languages,
  LanguageStatusItem,
  LanguageStatusSeverity,
  OutputChannel,
  ProgressLocation,
  window,
  workspace,
  WorkspaceConfiguration,
} from "vscode";
import Hsp3clProvider from "./provider/hsp3cl";
import Register from "./register";
import mu from "./myUtil";
import Launcher from "./launcher";

export interface Item {
  path: string;
  dir: string;
  name: string;
  kind?: string[];
}

export type Environment = { [key: string]: string };

export interface Provider {
  languageId: string[];
  dispose(): void;
  provideToolset(): Item[] | undefined | Promise<Item[] | undefined>;
  resolveTaskEnv(item: Item): Environment | undefined;
}

export interface Exports {
  current: Item | undefined;
  list: Item[];
  update(): Promise<void>;
  showQuickPick(filter?: (item: Item) => boolean): Promise<void>;
  onDidChangeCurrent(fn: (cur: Item | undefined) => void): void;
  registerToolsetProvider(name: string, provider: Provider): void;
}

export async function activate(context: ExtensionContext) {
  mu.devmode = context.extensionMode === ExtensionMode.Development;
  mu.log('extension "toolset-hsp3" is now active');

  // extention setup
  const extension = new Extension();
  context.subscriptions.push(extension);

  // providers setup
  const hsp3cl = new Hsp3clProvider(extension);
  extension.registerToolsetProvider(Hsp3clProvider.name, hsp3cl);
  context.subscriptions.push(hsp3cl);

  // launcher setup
  const launcher = new Launcher(extension);
  context.subscriptions.push(launcher);

  // start
  await extension.listing();
  const cur = extension.config.get<string>("current");
  extension.select(
    extension.list.find((el) => el.path === cur),
    false
  );

  return extension.exports;
}

export function deactivate() {}

export class Extension implements Disposable {
  private subscriptions: Disposable[] = [];
  public config: WorkspaceConfiguration;
  private statusbar: LanguageStatusItem;
  public output: OutputChannel;
  public register = {
    listener: new Register<void>(),
    provider: new Register<{ name: string; provider: Provider }>(),
  };
  private languageIds: string[] = [];
  public current: Item | undefined = undefined;
  public list: Item[] = [];

  constructor() {
    // config
    this.config = workspace.getConfiguration("toolset-hsp3");
    this.subscriptions.push(
      workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("toolset-hsp3")) {
          this.config = workspace.getConfiguration("toolset-hsp3");
          this.update();
        }
      })
    );

    // statusbar
    this.statusbar = languages.createLanguageStatusItem("toolset-hsp3", []);
    this.statusbar.text = "none";
    this.statusbar.detail = "Current Toolset";
    this.statusbar.command = {
      command: "toolset-hsp3.select",
      title: "Select",
      tooltip: undefined,
    };

    // output
    this.output = window.createOutputChannel("toolset-hsp3");
    this.output.hide();

    // commands
    this.subscriptions.push(
      commands.registerCommand(
        "toolset-hsp3.select",
        (options?: { item: Item } | { filter: (item: Item) => boolean }) => {
          if (options && "item" in options) this.select(options.item);
          else this.showQuickPick(options?.filter);
        }
      )
    );
  }

  public dispose() {
    this.statusbar.dispose();
    this.output.dispose();
    this.subscriptions.forEach((el) => el.dispose());
  }

  public check(item?: Item): boolean {
    item = item ? item : this.current;
    if (!item) return false;
    return this.list.findIndex((val) => val.path === item?.path) >= 0;
  }

  public draw() {
    const editor = window.activeTextEditor;
    if (this.current) {
      if (this.statusbar.severity !== LanguageStatusSeverity.Information)
        this.statusbar.severity = LanguageStatusSeverity.Information;
      this.statusbar.text = this.current.name;
      if (this.statusbar.command)
        this.statusbar.command.tooltip = this.current.path;
    } else {
      this.statusbar.text = "none";
      if (this.statusbar.command) this.statusbar.command.tooltip = undefined;
    }
  }

  public async listing(): Promise<void> {
    return new Promise((resolve) => {
      window.withProgress(
        { location: ProgressLocation.Window, title: "Listing Toolset" },
        async (progress, token) => {
          let list: Item[] = [];
          const providers = await Promise.all(this.register.provider.send());
          for (const v of providers) {
            this.languageIds = this.languageIds.concat(v.provider.languageId);
            try {
              const value = await v.provider.provideToolset();
              if (value !== undefined && value.length > 0)
                list = list.concat(value);
            } catch (error) {
              console.error(v.name, error);
              this.output.appendLine(`[${v.name}] ${(error as Error).message}`);
              this.output.show();
            }
          }
          this.list = list;
          this.statusbar.selector = this.languageIds.filter(
            (el, i) => this.languageIds.indexOf(el) === i
          );
          resolve();
        }
      );
    });
  }

  public select(item?: Item, save: boolean = true) {
    this.current = this.check(item) ? item : undefined;
    this.draw();

    if (save) this.config.update("current", item?.path);
    this.register.listener.send(this.current);
  }

  public async update() {
    await this.listing();
    this.select(this.current);
    this.draw();
  }

  public registerToolsetProvider(name: string, provider: Provider) {
    this.register.provider.registerListener(() => ({
      name,
      provider,
    }));
    this.update();
  }

  public async showQuickPick(filter?: (item: Item) => boolean) {
    let items: Item[];
    if (filter) items = this.list.filter(filter);
    else items = this.list;

    const list = items.map((v) => ({
      label: v.name,
      description: v.kind?.join(", "),
      detail: v.path,
      item: v,
    }));
    const result = await window.showQuickPick(list);
    if (result) this.select(result.item);
  }

  public exports: Exports = {
    current: this.current,
    list: this.list,
    update: this.update,
    showQuickPick: this.showQuickPick,
    onDidChangeCurrent: (fn: (cur: Item | undefined) => void) =>
      this.register.listener.registerListener(fn),
    registerToolsetProvider: this.registerToolsetProvider,
  };
}
