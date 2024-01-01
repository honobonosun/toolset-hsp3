# 拡張機能 開発者向け ノート

- パッケージマネージャーは npm です。
- コードフォーマッタは prettier です。
- 拡張機能はサーバー側で動作します。
- 多言語対応化は i18next を使用します。
- WSL に対応しています。
  - クロスプラットフォーム対応ですが、node_modules がネイティブバイナリを含むのに留意してください。
  - **プラットフォームごとに clone して npm install してください。**
- デバッグ実行するには、VSCode拡張機能 [esbuild Problem Matchers](https://marketplace.visualstudio.com/items?itemName=connor4312.esbuild-problem-matchers) が必要です。

# デバッグ方法

> [!NOTE]
> Node.js v18.13.0 以降のバージョンと、npm v8.19.3 以降のバージョンを使用しました。

`npm install`で必要なモジュールのインストールを行い、<kbd>F5</kbd>でデバッグ実行を行います。

# ビルド方法

`npm run make`を実行します。

# Override 機能

この拡張機能は、VSCode にインストールされた全ての拡張機能の package.json から"toolset-hsp3"オブジェクトの記述を確認します。

"toolset-hsp3"オブジェクトは、以下の構造体を求めます。構造体が満たされない場合、zod エラーをログへ出力して無視します。

```json
{
  "toolset-hsp3": {
    "version": "1.0.0",
    "override": {
      "enable": boolean,
      "settings"?: [
        {
          "id": "setting_id",
          "value": string | string[],
          "platform": "win32" | "darwin" | "linux",
          "scope": "undefined" | "false" | "true" | "Global" | "Workspace" | "WorkspaceFolder"
        }
      ],
      "reloadWindow"?: boolean
    }
  }
}
```

"toolset-hsp3"オブジェクトが記述されていなければ、下記の既定設定になります。

```json
{
  "toolset-hsp3": {
    "version": "1.0.0",
    "override": {
      "enable": true,
      "settings": undefined,
      "reloadWindow": false
    }
  }
}
```

## プロパティの解説

プロパティは、toolset-hsp3が起動した時点で、VSCodeにインストールされている拡張機能のpackage.jsonを参照します。

### version プロパティ

使用するプロパティ記述バージョンを文字列で指定します。

現在使用できるバージョンは `1.0.0` です。

### override プロパティ

拡張機能の設定を上書き指示を記述する省略可能なプロパティです。

省略された場合、上記の既定設定になります。

toolset-hsp3拡張機能のOverride機能が有効な場合、使用されます。

#### enable プロパティ

toolset-hsp3 にこの拡張機能の設定を上書きを許可するか指定します。

true で許可、false で不許可になります。

ユーザー側で設定の上書き指示があったとしても、不許可に指定された拡張機能の設定は、上書きすることはありません。

#### settings プロパティ

子プロパティ配列を記述します。このプロパティは省略可能です。省略した場合は空配列になります。

##### id プロパティ

上書きする設定IDを記述します。

設定IDが不明の場合、グラフィカルな設定画面より、設定項目を選択して、左側壁に出現する歯車マークから「設定 ID をコピー」で取得できます。
もしくは、拡張機能の「機能のコントリビューション」の設定から確認できます。

##### value プロパティ

上書きに使用する文字列。`%HSP3_ROOT%`など、%で囲むことで環境変数が展開されます。

文字列、もしくは文字列型配列で記述します。配列で記述した場合、配列は環境に応じて`\\`または`/`で連結されます。

##### platform プロパティ

上書きを実施する環境を指定します。このプロパティは省略可能です。省略された場合、全ての環境で設定を上書きします。

環境は以下の文字列で指定します。

'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', 'win32'.

##### scope プロパティ

設定の保存先を選択します。undefinedで、既定の保存先に上書き保存します。

#### reloadWindow プロパティ

trueの場合、設定が上書き保存できたら、ウィンドウの再読み込みを実施する。falseの場合、再読み込みは不要とする。

一部の拡張機能は、ウィンドウの再読み込みを行わないと設定の上書きが反映されない場合があります。

このプロパティで、ウィンドウの再読み込みが必要であることをtoolset-hsp3へ連絡します。
