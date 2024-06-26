# toolset-hsp3 changelog

## 2024/06/19 ver 1.1.1
- *fix* [#12](https://github.com/honobonosun/toolset-hsp3/issues/12) 内蔵したエージェントプロバイダーhsp3clの無限待機する不具合を修正しました。
- その他、動作の微調整を行いました。
- *update* package-lockの依存関係更新を行いました。
- *fix* package.jsonの翻訳キーとして%HSP3_ROOT%を検出してしまう。
  - キーがないとパッケージ化できないので、同じ文字をpackage.nls.jsonに登録して回避しました。

## 2024/01/08 ver 1.1.0
- *feat* [#8](https://github.com/honobonosun/toolset-hsp3/issues/8) プロパティな設定に上書きができるようになりました。

## 2024/01/04 ver 1.0.2
- *fix* changelog.mdの誤記修正しました。

## 2024/01/04 ver 1.0.1
- *fix* 環境変数の展開機能が未実装だったのを修正しました。

## 2024/01/01 ver 1.0.0
- *feat* hsp3rootをworkspaceStateに保存するように変更しました。
- *feat* hsp3rootが未選択の場合、HSP3_ROOT環境変数を自動で使用するようになりました。
- *feat* i18nextを使用して、日本語表示できるようになりました。
- *feat* zodを使用して、安全にJSONを読み込めるようになりました。
- *update* 公開APIを整理しました。

## 2022/01/22 ver 0.6.2
- *fix* Windowsで動作しない不具合を修正しました。

## 2022/01/21 ver 0.6.1
- *fix* [#4](https://github.com/honobonosun/toolset-hsp3/issues/4)の修正を行いました。

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
