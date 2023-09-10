メモ

- パッケージマネージャーは npm です。
- コードフォーマッタは prettier です。
- 拡張機能はサーバー側で動作します。
- WSL に対応しています。
  - クロスプラットフォーム対応ですが、node_modules がネイティブバイナリを含むのに留意してください。
  - プラットフォームごとに clone して npm install してください。

# 他の拡張機能の設定上書き機能について

toolset-hsp3の公開APIに対応していない拡張機能へ現在のhsp3rootの値を適用させる「設定上書き機能」を提供するOverrideモジュールを実装しました。

このモジュールは、拡張機能のpackage.jsonに静的もしくは、"toolset-hsp3.override.list"のリストを使用して対象の設定IDを現在のhsp3rootに上書きする二通りの方法で提供されます。

## 拡張機能側からOverride機能を使用する

拡張機能の開発者は、toolset-hsp3のOverride機能を自身のpackage.jsonに設定して使用する事ができます。

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