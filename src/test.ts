import mu from "./myUtil";
import * as cp from "child_process";
import util = require("util");

const f = async (
  cmd: string
): Promise<{ err: Error } | { version: string }> => {
  const exec = util.promisify(cp.exec);
  return exec(cmd)
    .then((values) => {
      const { stdout } = values;
      const r = stdout.match(/.+ver(\w+\.\w+)/);
      if (r && r[1]) return { version: r[1] };
      return {
        err: Object.assign(new Error("Specify the path to hsp3cl."), { cmd }),
      };
    })
    .catch((reason) => {
      const { stdout } = reason;
      if (typeof stdout === "string") {
        const r = stdout.match(/.+ver(\w+\.\w+)/);
        if (r && r[1]) return { version: r[1] };
        else return { err: reason };
      } else return { err: reason };
    });
};
