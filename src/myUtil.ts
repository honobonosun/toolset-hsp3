import * as vscode from "vscode";
import * as cp from "child_process";
import os = require("os");
import path = require("path");
import fs = require("fs/promises");
import util = require("util");
import * as glob from "glob";
import isGlob = require("is-glob");

export default class MyUtil {
  public static devmode: boolean = false;
  public static log(...prms: any) {
    if (this.devmode) console.log(prms);
  }

  /**
   * 行儀の悪いstring型例外も対応する、エラー型からmessageプロパティを抜き取る関数。
   * 抜き取れなかったら例外を横流しする。
   * @param err テキストを抜き取られるエラー値
   * @returns 抜き取られたテキスト
   */
  public static errMsg(err: any): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    throw err;
  }

  /**
   * %に囲まれた環境変数を展開します。前頭のチルダを展開します。
   * @param string 展開される前の文字
   * @param env 使用する環境変数が入った連想配列を指定します。keyの小文字大文字は区別されます。この引数を省略した場合、`process.env`の値が使用されます。
   * @returns 展開後の文字
   */
  public static normalize(string: string, env = process.env): string {
    // 環境変数
    string = string.replace(/%([^%]+)%/g, (match, p1) => env[p1] ?? match);
    // チルダ
    string = string.replace(/^~(\/|\\)/, os.homedir() + path.sep);
    string = string.replace(/^~\+(\+\/|\\)/, process.cwd() + path.sep);
    return string;
  }

  /**
   * globのPromise化
   */
  public static glob2 = util.promisify(glob);

  /**
   * hsp3clからバージョン情報を取り出します。
   * @param str hsp3clのパス
   * @param useWine 必要に応じてWineを使用するか
   * @param useWSL 必要に応じてWSLを使用するか
   * @returns 取得できたバージョン文字
   */
  public static async hsp3clVersion(
    str: string,
    useWine: boolean,
    useWSL: boolean
  ): Promise<{ err: Error } | { version: string }> {
    let precmd = "";
    const platform = os.platform();
    if (path.extname(str) === "" && platform === "win32" && useWSL)
      precmd = "wsl -- ";
    else if (path.extname(str) && platform !== "win32" && useWine)
      precmd = "wine ";
    const cmd = precmd + str;
    return util
      .promisify(cp.exec)(cmd)
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
  }

  /**
   * 指定されたパスがディレクトリか調べます。
   * @param name ディレクトリか調べるパス。
   * @returns 真ならディレクトリ、偽ならそれ以外。
   */
  public static async isDirectory(name: string): Promise<boolean> {
    return (await fs.stat(name)).isDirectory();
  }

  /**
   * 現在の環境がWSLか調べます。
   * @returns tureでWSL環境、falseならそれ以外の環境。
   */
  public static isWSL(): boolean {
    return process.env["WSL_DISTRO_NAME"] !== undefined;
  }

  /**
   * 指定されたフォルダを表示します。
   * @param name エクスプローラーで表示するフォルダ
   * @param env 環境変数
   */
  public static async openExplorer(name: string, env?: NodeJS.ProcessEnv) {
    const dirname = (await this.isDirectory(this.normalize(name, env)))
      ? name
      : path.dirname(name);
    switch (os.platform()) {
      case "win32":
        cp.exec("explorer.exe .", { cwd: dirname });
        break;
      case "darwin":
        cp.exec(`open ${dirname}`);
        break;
      default:
        if (this.isWSL()) cp.exec("explorer.exe .", { cwd: dirname });
        else cp.exec("xdg-open .", { cwd: dirname });
        break;
    }
  }

  public static async openFolderCommand(dirname: string) {
    let command: string;
    let cwd: string | undefined = undefined;
    let name: string;
    switch (os.platform()) {
      case "win32": {
        command = "explorer.exe .";
        cwd = dirname;
        name = "explorer";
      }
      case "darwin": {
        command = `open ${dirname}`;
        name = "Finder";
      }
      default: {
        if (this.isWSL()) {
          command = "explorer.exe .";
          cwd = dirname;
          name = "explorer";
        } else {
          command = "xdg-open .";
          cwd = dirname;
          name = "file manager";
        }
      }
    }
    return { command, cwd, name };
  }

  static object = {
    entries(obj: { [key: string]: any }): [string, any][] {
      let ownProps = Object.keys(obj),
        i = ownProps.length,
        resArray = new Array(i);
      while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
      return resArray;
    },
  };
}
