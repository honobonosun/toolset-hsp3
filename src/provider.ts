import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { AgentItem, AgentProvider, resolutionResult } from "./agent";

const hsp3clVersion = (
  path: string
): Promise<{ path: string; version: string } | { error: any }> =>
  new Promise(async (resolve, reject) => {
    let cmd = path;
    if ((await stat(path)).isDirectory()) {
      cmd = join(path, "hsp3cl");
      try {
        await stat(cmd);
      } catch (e) {
        cmd += ".exe";
      }
    }
    execFile(cmd, (error, stdout) => {
      const r = stdout.match(/ver(.*?) /);
      if (r && r[1]) resolve({ path: cmd, version: r[1] });
      else resolve({ error });
    });
  });

export const provider: AgentProvider = {
  name: "hsp3cl",
  resolve: async function (patterns: string[]) {
    let errors = [] as any[];
    let items = [] as AgentItem[];

    for (const el of patterns) {
      const result = await hsp3clVersion(el);
      if ("error" in result) errors.push(result.error);
      else items.push({ path: result.path, name: result.version });
    }
    return { errors, items };
  },
};
