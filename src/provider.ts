import * as vscode from "vscode";

export default class Provider implements vscode.TaskProvider {
  static typeName = "toolset-hsp3";
  constructor() {}

  public provideTasks(token: vscode.CancellationToken) {
    return undefined;
  }

  public resolveTask(
    task: vscode.Task,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Task> {
    console.log("resolveTask", task.definition.type);

    if (task.definition.type === Provider.typeName) {
      if (!task.execution && task.definition.command)
        task.execution = new vscode.ShellExecution(task.definition.command);
      return task;
    } else undefined;
  }
}
