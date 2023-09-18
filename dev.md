メモ

- パッケージマネージャーは npm です。
- コードフォーマッタは prettier です。
- 拡張機能はサーバー側で動作します。
- 多言語対応化は vscode の l10n を使用します。
- WSL に対応しています。
  - クロスプラットフォーム対応ですが、node_modules がネイティブバイナリを含むのに留意してください。
  - プラットフォームごとに clone して npm install してください。

# 他の拡張機能の設定上書き機能について

toolset-hsp3 の公開 API に対応していない拡張機能へ現在の hsp3root の値を適用させる「設定上書き機能」を提供する Override モジュールを実装しました。

このモジュールは、拡張機能の package.json に静的もしくは、"toolset-hsp3.override.list"のリストを使用して対象の設定 ID を現在の hsp3root に上書きする二通りの方法で提供されます。

## 拡張機能側から Override 機能を使用する

拡張機能の開発者は、toolset-hsp3 の Override 機能を自身の package.json に設定して使用する事ができます。

```json
{
  "toolset-hsp3": {
    "version": "1.0.0",
    "enable": true,
    "settings": [
      {
        "id": "launcher-hsp3.path.hspcmp",
        "value": ["%HSP3_ROOT%", "hspcmp"],
        "platform": "win32"
      }
    ],
    "reloadWindow": false
  }
}
```

## 上書き機能の拡張

"toolset-hsp3.override.listEx"を使用することで、より詳細に上書きする値を制御できます。
