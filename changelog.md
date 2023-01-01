# toolset-hsp3 changelog

## 2023/01/01 ver 0.6.0
- *update* hsp3rootの状態表示を強調するように変更しました。
  - 環境検索中はビジー表示されるようになりました。
  - 選択がnoneの場合はワーニング表示されるようになりました。
- *update* ToolsetProviderのログ表示に通常ログとパニックログの2種類に分けました。
  - 通常ログは、Provider側でエラー処理し終えたログが出力されます。
  - パニックログは、Provider側で拾われなかったエラーを拾ってログに出力します。
  - この二つは、従来通りtoolset-hsp3出力ペインに表示されます。

## 2022/11/29 ver 0.5.4
- *add* toolset-hsp3.current.toString コマンドを追加しました。
  - このコマンドの返り値はString型のHSP3開発環境のパスか、未指定を示すundefinedです。

## 2022/10/19 ver 0.5.3
- *fix toolset-hsp3.currentコマンドが[Command variables](https://code.visualstudio.com/docs/editor/variables-reference#_command-variables)に対応できていなかったのを修正しました。

## 2022/10/17 ver 0.5.2
- *fix* toolset-hsp3.currentコマンドの引数と返り値を変更しました。
- *fix* toolset-hsp3.openコマンドで拡張機能が起動するように修正しました。

## 2022/10/13 ver 0.5.0
- *add* onDidChangeCurrentメソッドを実装しました。
- *add* hsp3rootをエクスプローラーなどで開くコマンドを実装しました。

## 2022/10/12 ver 0.4.0
- ミニファイにESBuildを採用しました。
- launch機能を撤廃しました。
