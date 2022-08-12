import { ExtensionContext } from "vscode";

export async function activate(context: ExtensionContext) {
  console.log(["active toolset-hsp3"])
}
export function deactivate() {
  console.log(["close toolset-hsp3"])
}