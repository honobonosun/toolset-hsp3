/* eslint-disable @typescript-eslint/naming-convention */
import { Environment, Item, Provider } from "../extension";

export default class TestProvider implements Provider {
  languageId = ["hsp3"];
  dispose() {}
  provideToolset(): Item[] | Promise<Item[] | undefined> | undefined {
    return undefined;
  }
  resolveTaskEnv(item: Item): Environment | undefined {
    return {
      VSCODE_NEKO: "NEKO",
      path: "C:\\bin",
    };
  }
}
