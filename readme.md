# toolset-hsp3

HSP3 開発環境のパスを自動で設定する VSCode 拡張機能です。

## 概要

この拡張機能は、VSCode がインストールされた（ホスト側）PC にある HSP3 開発環境を[glob](https://github.com/isaacs/node-glob)で検索します。

検索された HSP3 開発環境は、VSCode の HSP 言語バーから選択可能になります。

選択された HSP3 開発環境は、hsp3root として設定され、VSCode のターミナルで使用される環境変数や、他の拡張機能へ提供、設定の上書きを行います。

この拡張機能を適当に設定すれば、複数の HSP3 開発環境をインストールしても、言語バーから選択するだけで、VSCode 上の設定や構成を切り替えることができます。

### hsp3root

hsp3root は、HSP3 開発環境のディレクトリパス、バージョン名が格納されています。必要に応じて、他の拡張機能は公開 API や内部コマンドから参照する事ができます。

hspc は、VSCode ターミナルか、language-hsp3 の"Run HSP Program"を通して、選択された hsp3root の HSP3 開発環境のディレクトリパスを取得します。

## 動作環境

本拡張機能は、VSCode v1.70.3（Windows 7 最後の対応バージョン）とそれ以降のバージョンに対応しています。

toolset-hsp3 に内蔵されているエージェントプロバイダーが検索する対象は、Windows 版と、OpenHSP 版の二種になります。

Wine には対応していません。ホスト側でネイティブに動作する開発環境が検索されます。

- Windows
  - HSP3.51 以降の hsp3cl.exe
  - HSP3 開発環境を自動検索するには、インストーラー既定のインストール先にインストールしてください。
    - 例：`C:\hsp351\hsp3cl.exe`、`C:\hsp37beta\hsp3cl.exe`。
- WSL2, Ubuntu などの Linux 環境
  - OpenHSP の hsp3cl
  - 現バージョンでは、OpenHSP 開発環境の自動検索はされません。

内蔵しているエージェントプロバイダーは、hsp3cl のバージョン名を言語バー表示に使用します。

エージェントプロバイダーは、他の拡張機能によって追加されることがあります。追加されたエージェントプロバイダーについては、その拡張機能を参照してください。

## 使い方

hsp ファイル、as ファイルが含まれるディレクトリ、もしくはファイルそのものを開くことで本拡張機能は起動します。

HSP3_ROOT 環境変数が在れば、そのディレクトリパスを自動適用します。

> [!NOTE]
> VSCode を起動する際、`VSCODE_HSP3ROOT_PRIORITY`環境変数に`true`もしくは`1`の値が在れば、ワークスペースに保存した hsp3root より、HSP3_ROOT 環境変数を優先して適用します。

hsp3root が none 表記されている場合、未選択な状態です。hsp3root を必要とする処理は、続行されません。

hsp3root は、コマンドパレット"toolset-hsp3.select"の実行もしくは、言語バーから選択可能です。

hsp3root が選択されると、言語バーに hsp3cl のバージョン名が表示されます。hsp3root が必要な処理が実行可能になります。

### language-hsp3 for VSCode と hspc を組み合わせる。

[language-hsp3 for VSCode](https://marketplace.visualstudio.com/items?itemName=honobonosun.language-hsp3) と [hspc](https://dev.onionsoft.net/seed/info.ax?id=1392) を導入することで、複数の HSP3 開発環境の中から言語バーで選択するだけで、使用する開発環境を切り替えることができます。

- `language-hsp3.compiler`に hspc.exe の絶対パスを設定します。
- toolset-hsp3 の hsp3root を選択状態にします。
- "Run HSP Program" でソースファイルを実行できます。

### hspc でソースファイルを診断する。

hspc の lint 機能と、VSCode のタスク機能を活用します。

本拡張機能は、タスク機能のターミナルに HSP3_ROOT 環境変数を提供する機能があります。ホスト側ユーザー設定の`toolset-hsp3.env.enable`を`true`にすることで、hsp3root と同じ環境で`hspc lint`を実行できます。

vscode/tasks.json の詳細は、ブログの [VSCode と hspc v3 で構文エラーをエディタ上に表示する](https://honobonopoo.hatenablog.jp/entry/2021/10/15/224532) を参照してください。

> .vscode/tasks.json
>
> ```json
> {
>   "version": "2.0.0",
>   "tasks": [
>     {
>       "label": "hspc lint",
>       "type": "shell",
>       "args": ["lint", "--background", "--iniv", "${workspaceFolder}\\src"],
>       "command": "hspc",
>       "group": "none",
>       "problemMatcher": [
>         {
>           "owner": "hsp3",
>           "fileLocation": "autoDetect",
>           "pattern": [
>             {
>               "regexp": "^(.+)\\((\\d+)\\): (info|error) (?:\\d+)?(.+)$",
>               "file": 1,
>               "line": 2,
>               "severity": 3,
>               "message": 4
>             }
>           ],
>           "background": {
>             "activeOnStart": true,
>             "beginsPattern": "^\\d{1,2}:\\d{1,2}:\\d{1,2} - File change detected\\. Starting compilation\\.$",
>             "endsPattern": "^\\d{1,2}:\\d{1,2}:\\d{1,2} - Compilation complete\\. Watching for file changes\\.$"
>           }
>         }
>       ],
>       "isBackground": true
>     }
>   ]
> }
> ```

### vain0x 様作成の拡張機能を上書き設定する。

"他の拡張機能の設定を上書きする"機能を使用することで、擬似的に設定を同期することができるようになりました。

ユーザー設定（ホスト側）で設定します。

```json
{
  "toolset-hsp3.override.enable": true,
  "toolset-hsp3.override.applyChangesImmediately": true,
  "toolset-hsp3.override.applyChangesImmediatelyInReloadWindow": true,
  "toolset-hsp3.override.list": [
    "vain0x.hsp3-debug-window-adapter.hsp3-root",
    "vain0x.hsp3-analyzer-mini.hsp3-root"
  ]
}
```

HSP3 アナライザー・ミニ (LSP)（"vain0x.hsp3-analyzer-mini"）の設定を上書きしない場合、`vain0x.hsp3-analyzer-mini.hsp3-root`と、`toolset-hsp3.override.applyChangesImmediatelyInReloadWindow`の設定は不要です。

### タスク機能で様々な HSP3 開発補助ツールを起動する。

VSCode には、".vscode/tasks.json"でタスクを構成する事ができます。「hspc でソースファイルを診断する。」で紹介したように、様々な処理を VSCode のターミナルで実行する事ができ、tasks.json で登録しておくことができます。

例として、現在の hsp3root で指定されている HSP3 開発環境の HDL でキーワードを検索するコマンドの構成を下記に記載します。

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "hsp3",
      "type": "shell",
      "command": "${command:toolset-hsp3.hsp3root}\\hdl.exe",
      "args": ["${input:keyword}"]
    }
  ],
  "inputs": [
    {
      "id": "keyword",
      "type": "promptString",
      "description": "調べたいキーワードを入力"
    }
  ]
}
```

### VSCode ターミナルで環境変数を活用する。

本拡張機能は、選択された hsp3root を元に環境変数をターミナルへ提供します。

HSP3_ROOT 環境変数と、Path 環境変数に、hsp3root の HSP3 開発環境のディレクトリパスが挿入されます。

## 設定

本拡張機能はホスト側に依存する処理が多いため、殆どの設定がホスト側ユーザー設定で行う必要があります。

### 検索対象のディレクトリを設定する。HSP3 開発環境を追加する。

インストーラーの既定インストール先以外にインストールされた HSP3 開発環境や、OpenHSP 開発環境を検索、選択するには、`toolset-hsp3.globs`にディレクトリパスを絶対パスで追加してください。

ディレクトリにまとめてインストールされている場合、glob パターンで設定する事もできます。glob パターンについては、[node-glob](https://github.com/isaacs/node-glob#glob-primer) を参照してください。

### 通知のポップアップを抑制する。

本拡張機能は、hsp3root が暗黙で変更された際、使用者のトラブルを防ぐために通知します。この通知が煩わしい場合、ホスト側ユーザー設定から抑止することできます。

`toolset-hsp3.agent.autoChoice.showPopInfo`は、起動時に hsp3root が未選択だった場合、自動で HSP3_ROOT 環境変数が適用されたことを通知するか設定します。

`toolset-hsp3.log.autoPop`は、ログ出力が更新された際、通知するか設定します。この通知は、`toolset-hsp3.log.infoLimit`で設定することができます。

`toolset-hsp3.override.showPopInfo`は、ウィンドウの再読み込みが必要になった際に通知で再読み込みするか確認します。false に設定した場合、使用者に確認せずウィンドウの再読み込みを行います。

### 他の拡張機能の設定を上書きする。

既定値では、他の拡張機能の設定を勝手に上書きすることはございません。

上書き機能を有効にするには、ホスト側ユーザー設定で有効にしてください。

`toolset-hsp3.override.enable`を`true`にすることで、本拡張機能は VSCode にインストールされている殆どの設定を上書きできるようになります。（一部の設定は、セキュリティのため上書きを行えません。例：ターミナルプロファイルなど）

`toolset-hsp3.override.list`と、`toolset-hsp3.override.listEx`で、設定を上書きできます。

上書きする設定は、文字列型である必要があります。

`toolset-hsp3.override.list`は、文字列型配列です。パブリッシャー名と設定 ID をドットでつなげたキーで設定します。

> [!NOTE]
> 追加するパブリッシャーと設定 ID が`honobonosun.toolset-hsp3.test.path`になる場合、パブリッシャー名として`honobonosun`、設定 ID が`toolset-hsp3.test.path`になります。
>
> ```json
> {
>   "toolset-hsp3.override.list": ["honobonosun.toolset-hsp3.test.path"]
> }
> ```

`toolset-hsp3.override.listEx`は、より詳細に設定することができます。

```json
{
  "toolset-hsp3.override.listEx": [
    {
      "publisher": "honobonosun",
      "id": "test.path",
      "value": ["%HSP3_ROOT%", "hsphelp", "helpman.exe"],
      "platform": "win32",
      "scope": "undefined"
    }
  ]
}
```

- `publisher`には、パブリッシャー名を記述します。
- `id`には、設定 ID を記述します。
- `value`には、上書きに使用する文字を記述します。文字列型もしくは、文字列型配列です。%文字で囲むことで、環境変数を展開することができます。
- `plarform`には、上書きを実行するプラットフォームを記述します。特定のプラットフォームでのみ、上書きを実施したいときに使用してください。省略することで、全てのプラットフォームで上書きを実施します。
- `scope`には、[WorkspaceConfiguration](https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration) の update メソッド configurationTarget 引数 を文字列で記述します。

`toolset-hsp3.override.ignores`は、上書きを行わないパブリッシャー名と設定 ID を記述します。この設定は、上書きすると不都合や不具合がある場合に使用します。記述方法は、[micromatch](https://github.com/micromatch/micromatch#matching-features) を使用します。（例：`honobonosun\.language-hsp3\.**`、ドットはエスケープが必要な場合があります。）

### ターミナルへの貢献度を設定する。

本拡張機能は、VSCode のターミナルへ環境変数を提供します。この機能は、`toolset-hsp3.env.enable`を false に設定することで停止できます。

本拡張機能が提供する環境変数は、`HSP3_ROOT`と、`Path`になります。

環境変数の提供は、`toolset-hsp3.env.HSP3_ROOT.enable`と、`toolset-hsp3.env.PATH.enable`で、値の提供の可否を設定する事ができます。既定値では両方とも true（提供する）になります。

HSP3_ROOT 環境変数と、Path 環境変数には、現在選択されている hsp3root のディレクトリパスが追加格納されます。

追加位置は、`toolset-hsp3.env.HSP3_ROOT.priority`と、`toolset-hsp3.env.PATH.priority`で変更できます。

## LICENSE（利用規約）

本拡張機能を使用することで使用者へ適用される利用規約は、以下のリンク先に記載されています。

- [toolset-hsp3](./LICENSE)
- [glob](https://github.com/isaacs/node-glob/blob/main/LICENSE)
- [i18next](https://github.com/i18next/i18next/blob/master/LICENSE)
- [micromatch](https://github.com/micromatch/micromatch/blob/master/LICENSE)
- [semver](https://github.com/npm/node-semver/blob/main/LICENSE)
- [zod](https://github.com/colinhacks/zod/blob/master/LICENSE)

上記全ての規約に同意できない場合、本拡張機能の使用は、お控えいただきますようお願い申し上げます。

リンク先が消失された場合、イシュー頂ければ幸いです。（イシュー先： https://github.com/honobonosun/toolset-hsp3/issues ）
