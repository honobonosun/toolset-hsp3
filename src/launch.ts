import {
  Disposable,
  ExtensionContext,
  ProviderResult,
  ShellExecution,
  Task,
  TaskProvider,
  TaskScope,
  tasks,
} from "vscode";
import { Agent } from "./agent";

export class Launcher implements Disposable {
  constructor(
    private readonly context: ExtensionContext,
    private readonly agentMethods: Agent["method"]
  ) {
    context.subscriptions.push(
      tasks.registerTaskProvider("toolset-hsp3.launch", this.provider)
    );
  }
  dispose() {}

  launch(command: string, args: string[], cwd: string) {
    return tasks.executeTask(
      new Task(
        {
          type: "toolset-hsp3.launch",
        },
        TaskScope.Workspace,
        "toolset-hsp3",
        "toolset-hsp3.launch",
        new ShellExecution(command, args, { cwd })
      )
    );
  }

  provider: TaskProvider = {
    provideTasks: (): ProviderResult<Task[]> => {
      return;
    },
    resolveTask: (task: Task): ProviderResult<Task> => {
      if (task.definition.type === "toolset-hsp3.launch") {
        return new Task(
          task.definition,
          task.scope ?? TaskScope.Workspace,
          task.name,
          task.source,
          task.execution
        );
      } else {
        return;
      }
    },
  };
}
