import * as vscode from "vscode";

type Result<T> = Promise<T> | T;
type CallBack<T> = (...args: any) => Result<T>;

export default class Register<T> implements vscode.Disposable {
  private subscriptions: vscode.Disposable[] = [];
  private listeners: { [key: symbol]: CallBack<T> } = {};
  private list: symbol[] = [];

  constructor() {}
  dispose() {
    this.subscriptions.forEach((el) => el.dispose());
  }

  send(...args: any): Result<T>[] {
    let r: Result<T>[] = [];
    this.list.forEach((i) => r.push(this.listeners[i](...args)));
    return r;
  }

  registerListener(fn: CallBack<T>): vscode.Disposable {
    const symbol = Symbol();
    this.listeners[symbol] = fn;
    this.list.push(symbol);
    return {
      dispose: () => {
        delete this.listeners[symbol];
        delete this.list[this.list.indexOf(symbol)];
      },
    };
  }
}

/*
let a = new Register<string[]>();
a.registerListener(() => ["neko"]);
let b = a.send();
console.log(b);
*/
