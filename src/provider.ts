import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { AgentItem, AgentProvider } from "./agent";

const hsp3clVersion = (
  path: string
): Promise<{ path: string; version: string } | { error: any }> =>
  new Promise((resolve, reject) => {
    let cmd = path;
    stat(path)
      .then((val) => {
        if (val.isDirectory()) {
          cmd = join(path, "hsp3cl");
          return stat(cmd).then(
            () => cmd,
            () => `${cmd}.exe`
          );
        }
        return cmd;
      })
      .then((val) => {
        try {
          execFile(val, (error, stdout) => {
            const r = stdout.match(/ver(.*?) /);
            if (r && r[1]) resolve({ path: val, version: r[1] });
            resolve({ error });
          });
        } catch (err) {
          if (err instanceof Error)
            Object.assign(err, { message: `PATH : [${val}] ${err.message}` });
          resolve({ error: err });
        }
      });
  });

export const provider: AgentProvider = {
  name: "hsp3cl",
  resolve: async function (patterns: string[]) {
    const errors = [] as unknown[];
    const items = [] as AgentItem[];

    for (const el of patterns) {
      const result = await hsp3clVersion(el);
      if ("error" in result) errors.push(result.error);
      else items.push({ path: result.path, name: result.version });
    }
    return { errors, items };
  },
};
