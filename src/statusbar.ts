import * as vscode from "vscode";
export default class Statusbar implements vscode.Disposable {
  private statbar: vscode.StatusBarItem;
  constructor() {
    this.statbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
    vscode.window.setStatusBarMessage("statbar msg.");
  }
  select() {}
  get() {}
  setItems() {}
  dispose() {
    this.statbar.dispose();
  }
}