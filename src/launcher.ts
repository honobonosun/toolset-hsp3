import { exec } from "child_process";
import fs = require("fs");
import path = require("path");
import os = require("os");
import * as vscode from "vscode";
import mu from "./myUtil";
import { Extension } from "./extension";
import Provider from "./provider";

export default class Lancher implements vscode.Disposable {
  private subscriptions: vscode.Disposable[] = [];
  private provider: Provider;

  constructor(private extension: Extension) {
    this.provider = new Provider();
    this.subscriptions.push(
      vscode.tasks.registerTaskProvider(Provider.typeName, this.provider)
    );

    this.subscriptions.push(
      vscode.commands.registerCommand("toolset-hsp3.launch", this.launch, this)
    );
  }

  dispose() {
    this.subscriptions.forEach((v) => v.dispose());
  }

  async createTask(toolpath: string): Promise<vscode.Task | undefined> {
    return;
  }

  async launch(args?: { label: string; detail: string }) {
    if (this.extension.current === undefined) {
      vscode.window.showErrorMessage(
        "The hsp3root to be used is not selected. Please select it."
      );
      return;
    }

    const dirname = (await mu.isDirectory(this.extension.current.path))
      ? this.extension.current.path
      : path.dirname(this.extension.current.path);

    const tools = <string[] | undefined>this.extension.cfg.get("paths.tool");
    let list = [
      {
        label: "exporer",
        detail: "Open the hsp3root folder in Explorer",
      },
    ];
    tools?.forEach((el) =>
      list.push({ label: el, detail: path.join(dirname, el) })
    );

    if (!args) {
      args = await vscode.window.showQuickPick(list);
      if (!args) return;
    }

    if (args.label === "exporer") mu.openExplorer(dirname);
    else {
      const cwd = <string | undefined>this.extension.cfg.get("tool.launch.cwd");
      const command = this.extension.cfg.get("useWine")
        ? `wine ${args.detail}`
        : args.detail;
      const label = args.label;
      const definition = { type: Provider.typeName, command, label };
      const task = new vscode.Task(
        definition,
        vscode.TaskScope.Workspace,
        label,
        Provider.typeName,
        new vscode.ShellExecution(command, { cwd })
      );
      vscode.tasks.executeTask(task);
    }
  }
}
