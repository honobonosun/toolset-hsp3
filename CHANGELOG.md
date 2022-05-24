# Change Log

All notable changes to the "toolset-hsp3" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

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
