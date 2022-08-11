import { exec } from "child_process";
import { platform } from "os";
import { isAbsolute, join } from "path";
import { promisify } from "util";
import {
  commands,
  Disposable,
  ProgressLocation,
  QuickPickItem,
  Range,
  ShellExecution,
  Task,
  TaskDefinition,
  TaskProvider,
  tasks,
  TaskScope,
  TextEditor,
  window,
  workspace,
  WorkspaceFolder,
} from "vscode";
import { Environment, Extension, Item } from "./extension";

interface Definition extends TaskDefinition {
  type: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: { [key: string]: string };
}

type Provider = Disposable & TaskProvider;

function editorGetWord(textEditor: TextEditor): string {
  const selection = textEditor.selection;
  const seltext = textEditor.document.getText(
    new Range(selection.active, selection.anchor)
  );
  if (seltext !== "") return seltext;
  else {
    const position = textEditor.selection.start;
    const wordRange = textEditor.document.getWordRangeAtPosition(
      position,
      RegExp(
        "(-?\\d*\\.\\d\\w*)|([^\\`\\~\\!\\%\\^\\&\\*\\(\\)\\-\\=\\+\\[\\{\\]\\}\\\\\\|\\;\\:\\'\\\"\\,\\.\\<\\>\\/\\?\\s]+)"
      )
    );
    return textEditor.document.getText(wordRange);
  }
}

async function winepath(path: string): Promise<string> {
  const result = await promisify(exec)(`winepath -u "%{path}"`);
  return result.stdout;
}

export default class Launcher implements Provider {
  static typeName = "toolset-hsp3";

  private subscriptions: Disposable[] = [];

  constructor(private extension: Extension) {
    this.subscriptions.push(
      tasks.registerTaskProvider(Launcher.typeName, this)
    );

    this.subscriptions.push(
      commands.registerCommand("toolset-hsp3.launch", this.launch, this)
    );

    this.subscriptions.push(
      commands.registerCommand("toolset-hsp3.get.keyword", () => {
        const editor = window.activeTextEditor;
        return editor ? editorGetWord(editor) : "";
      })
    );
    this.subscriptions.push(
      commands.registerCommand(
        "toolset-hsp3.get.dirname",
        () => this.extension.current?.dir ?? ""
      )
    );
    this.subscriptions.push(
      commands.registerCommand(
        "toolset-hsp3.get.path",
        () => this.extension.current?.path ?? ""
      )
    );
  }

  dispose() {
    this.subscriptions.forEach((el) => el.dispose());
  }

  private current(): Item | undefined {
    const current = this.extension.current;
    if (!current) {
      this.extension.output.appendLine(
        "The toolset to be used is not selected. Please select it. After selecting, execute the command again."
      );
      this.extension.output.show(true);
      return undefined;
    }
    return current;
  }

  private command(cmd: string, item: Item, absolute: boolean): string {
    let command = absolute && !isAbsolute(cmd) ? join(item.dir, cmd) : cmd;
    //if (this.extension.config.get("launch.useWine")) command = `wine %{cmd}`;
    return command;
  }

  private cwd(): string | undefined {
    const cwd = this.extension.config.get<string>("launch.cwd");
    if (cwd === "") return undefined;
    return cwd;
  }

  private async env(item: Item, env: Environment): Promise<Environment> {
    let tmpenv: Environment = {};
    let envs: { [key: string]: Environment } = Object.create(null);
    envs.default = env;
    let error: string[] = [];
    const separator = platform() === "win32" ? ";" : ":";

    // fetch provideEnv
    (await Promise.allSettled(this.extension.register.provider.send())).forEach(
      (v) => {
        if (v.status === "fulfilled") {
          const r = v.value.provider.resolveTaskEnv(item);
          if (r) envs[v.value.name] = r;
          else error.push(`[launch.${v.value.name}] failed resolveTaskEnv`);
        } else error.push((v.reason as Error).message);
      }
    );
    if (error.length > 0) {
      error.forEach((msg) => this.extension.output.appendLine(msg));
      this.extension.output.show(true);
    }

    // provide result merge
    const cache = new Map<string, string[]>();
    for (const name in envs)
      for (const key in envs[name])
        if (cache.has(key.toUpperCase()))
          cache.set(
            key.toUpperCase(),
            (cache.get(key.toUpperCase()) ?? []).concat(
              envs[name][key].split(separator)
            )
          );
        else cache.set(key.toUpperCase(), envs[name][key].split(separator));

    // add ${env:KEY}
    if (0)
      for (const key in cache)
        cache.set(key, (cache.get(key) ?? []).concat([`\${env:${key}}`]));

    // delete duplicates
    let tmp: { [key: string]: string[] } = {};
    for (const el of cache)
      tmp[el[0]] = el[1].filter((v, i) => el[1].indexOf(v) === i);

    // re-merge
    if (1)
      for (const key in tmp)
        tmpenv[key] = tmp[key].join(";") + `${separator}\${env:${key}}`;
    else for (const key in tmp) tmpenv[key] = tmp[key].join(separator);

    return tmpenv;
  }

  async makeTasks(): Promise<Task[] | null | undefined> {
    let result: Task[] = [];

    const current = this.current();
    if (!current) return [];

    let scope: WorkspaceFolder | TaskScope.Global | TaskScope.Workspace;
    const uri = window.activeTextEditor?.document.uri;
    if (uri) scope = workspace.getWorkspaceFolder(uri) ?? TaskScope.Workspace;

    const absolute =
      this.extension.config.get<boolean>("launch.absolute") || false;
    const cwd = this.cwd();
    const env = await this.env(current, {});

    const commands = this.extension.config.get<string[]>("launch.commands");
    if (!commands) {
      this.extension.output.appendLine(
        "No commands are set in `toolset-hsp3.launch.commands`"
      );
      this.extension.output.show(true);
      return [];
    }
    commands.forEach((cmd) => {
      const command = this.command(cmd, current, absolute);
      result.push(
        new Task(
          { type: Launcher.typeName, command, env, cwd },
          scope,
          command,
          "toolset-hsp3",
          new ShellExecution(command, { cwd, env })
        )
      );
    });

    return result;
  }

  async provideTasks(): Promise<Task[] | null | undefined> {
    if (0)
      return this.makeTasks(); // タスク構成で候補を出したいなら1に。ただし、envがおかしくなる。
    else return undefined;
  }

  async resolveTask(task: Task): Promise<Task | undefined> {
    console.log("resolveTask task", task.definition.env, task.execution);

    if (task.definition.type !== Launcher.typeName) return;

    const current = this.current();
    if (!current) return;

    let absolute = task.definition.absolute;
    if (absolute === undefined)
      absolute = this.extension.config.get<boolean>("launch.absolute") || false;
    const command = this.command(task.definition.command, current, absolute);
    const cwd = this.cwd();
    const env = await this.env(current, task.definition.env ?? {});
    console.log(["resolveTask env", env]);

    return new Task(
      task.definition,
      task.scope ?? TaskScope.Workspace,
      task.name,
      task.source,
      task.execution ??
        new ShellExecution(command, task.definition.args, { cwd, env })
    );
  }

  async launch() {
    const list = window.withProgress(
      {
        location: ProgressLocation.Window,
        title: "fetchTasks",
      },
      async () => {
        let result: (QuickPickItem & { task: Task })[] = [];
        // 本当はtasks.jsonも読み込みたかったけど、envが反映されないのです...
        if (0)
          (await tasks.fetchTasks({ type: Launcher.typeName })).forEach(
            (el) => {
              result.push({
                label: el.name,
                description: el.source,
                detail: el.definition.command,
                task: el,
              });
            }
          );
        // 当分の間はコッチを使います。
        if (1)
          (await this.makeTasks())?.forEach((el) => {
            result.push({
              label: el.name,
              description: el.source,
              detail: el.definition.command,
              task: el,
            });
          });
        return result;
      }
    );
    const sel = await window.showQuickPick(list);
    if (sel) tasks.executeTask(sel.task);
  }
}
