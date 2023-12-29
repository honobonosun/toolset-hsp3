拡張機能 開発者向け ノート

- パッケージマネージャーは npm です。
- コードフォーマッタは prettier です。
- 拡張機能はサーバー側で動作します。
- 多言語対応化は i18next を使用します。
- WSL に対応しています。
  - クロスプラットフォーム対応ですが、node_modules がネイティブバイナリを含むのに留意してください。
  - **プラットフォームごとに clone して npm install してください。**

# Override 機能

この拡張機能は、VSCode にインストールされた全ての拡張機能の package.json から"toolset-hsp3"オブジェクトの記述を確認します。

"toolset-hsp3"オブジェクトは、以下の構造を求めます。満たされない場合、zod エラーをログへ出力して無視します。

```json
{
  "toolset-hsp3": {
    version: "1.0.0",
    enable: boolean,
    settings?: [
      {
        id: "publisher_name",
        value: string | string[],
        platform: "win32" | "darwin" | "linux",
        scope: "undefined" | "false" | "true" | "Global" | "Workspace" | "WorkspaceFolder"
      }
    ],
    reloadWindow?: boolean
  }
}
```

"toolset-hsp3"オブジェクトが記述されていなければ、下記の既定構成になります。

```json
{
  "toolset-hsp3": {
    "version": "1.0.0",
    "enable": true,
    "settings": undefined,
    "reloadWindow": false
  }
}
```

## プロパティの解説

### version プロパティ

使用する構成のバージョンを文字列で指定します。

現在のバージョンは 1.0.0 です。

### enable プロパティ

toolset-hsp3にこの拡張機能の設定を上書きを許可するか指定します。

trueで許可、falseで不許可になります。

ユーザー側で設定の上書き指示があったとしても、不許可に指定された拡張機能の設定は、上書きすることはありません。

### settings プロパティ

#### id プロパティ
#### value プロパティ
#### platform プロパティ
#### scope プロパティ

### reloadWindow プロパティ
