メモ

- パッケージマネージャーはnpmです。
- コードフォーマッタはprettierです。
- 拡張機能はサーバー側で動作します。
- WSLに対応しています。
  - クロスプラットフォーム対応ですが、node_modulesがネイティブバイナリを含むのに留意してください。
  - プラットフォームごとにcloneしてnpm installしてください。

# 他の拡張機能の設定上書き機能について

v0.7.xで、override機能を実装しました。この機能は、"toolset-hsp3.override.list"に登録した設定IDに対して、現在選択されているhsp3rootの値で上書きします。
上書き保存なので、以前の設定内容は消えてしまいます。以前の環境に戻せるように、事前に"toolset-hsp3.globs"へ登録してください。

override機能は、"toolset-hsp3.override.enable"をtrueに設定する事で有効化されます。
設定を上書きするタイミングは、'toolset-hsp3.override"コマンド実行時、もしくは、"toolset-hsp3.override.applyChangesImmediately"がtrueの状態で、hsp3rootを変更した時、toolset-hsp3拡張機能が起動した時になります。

上書きの際、"toolset-hsp3.override.applyChangesImmediatelyInReloadWindow"がtrueな場合、VSCodeのウィンドウを再読み込みして、全ての拡張機能を再起動します。

"toolset-hsp3.override.scope"で、設定の上書き保存先を設定できます。falseでワークスペースに、trueでグローバルに、nullでワークスペースフォルダーもしくは、ワークスペースに上書き保存されます。

_既定値で悩んでいます。できるだけプロジェクトに近い場所に保存するのであれば、nullがよいです。しかし、プロジェクトの設定を他者や他のマシンと共有している場合、望ましくありません。hsp3rootの値はマシン依存であるためです。次点として、ユーザー設定のtrueが上げられます。その場合、既存の設定を上書きしてしまいます。_
_インストールして、hsp3rootを選択したら、既存の設定を破壊していた。というシチュエーションは回避する必要があります。_