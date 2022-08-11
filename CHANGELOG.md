# Change Log

All notable changes to the "toolset-hsp3" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.0] - 2022-08-10

### Added

- ToolsetProvider に resolveTaskEnv メソッドを追加しました。
- HSP3 以外の言語でも toolset 選択を横断的に実現しました。
- コマンド実行時に、環境変数の変更を適用する機能を実装しました。
  - resolveTaskEnv から提供を受けて、変更内容が決定します。

### Changed

- 情報取得用コマンド名を変更しました。

### Removed

- 設定に使用できる特殊文字を廃止しました。
  - 以後は[Variables Reference](https://code.visualstudio.com/docs/editor/variables-reference)を使用してください。

## [0.2.1] - 2022-06-09

### Added

- コマンド起動の文字に特殊文字の置き換えを実装しました。

## [0.1.2] - 2022-04-12

### Added

- 外部提供する API に`onDidChangeCurrent`, `onDidChangeToolsetList` を追加しました。

### Removed

- 外部提供用の API `hsp3root` を廃止しました。

## [0.0.3] - 2022-03-10

### Changed

- paths.search や、provider から提供される glob パターンに加えてファイルパスも受け付けるように再実装しました。

## [0.0.2] - 2022-03-09

### Added

- node-glob パターンを他の拡張機能から追加する API を実装しました。

## [0.0.1] - 2022-02-26

### Added

- node-glob を使用した HSP3root の検索を実装しました。
- プロジェクト最後に使用していた HSP3root を復元する機能を追加しました。
- glob パターンの設定を変更した後、現在の HSP3root が見つからない場合、none に設定する仕様を実装しました。
