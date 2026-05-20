# DELTA Robot Tune

アークナイツ：エンドフィールドのDELTAロボットのパズルを、画像取り込みから自動で解くことを目的とした非公式ファンツールです。

公開ページ: https://arkpazle.pages.dev/

## Features

- スクリーンショットから盤面・ピース・行列条件を下書きします。
- 読み取り結果を手動で補正できます。
- 確定した条件をもとに、配置候補を計算します。
- 読み込んだ画像はブラウザ内で処理し、サーバーへアップロードしません。

## Usage

1. ゲーム画面のスクリーンショットを読み込みます。
2. 盤面サイズを合わせて、デルタ解析を実行します。
3. 黄色い盤面枠、ピース形状、行列条件を確認します。
4. 必要なところだけ手動で直します。
5. 確かな条件をロックして `RUN PROTOCOL` を実行します。

## Supported Images

パズル盤面、行列条件、ピース一覧が同じスクリーンショット内に写っている画像を想定しています。

動作確認はPCブラウザ中心です。スマホでも表示や画像選択はできる場合がありますが、画像確認や盤面補正はPCブラウザ推奨です。

以下の画像では読み取りに失敗することがあります。

- 盤面やピースが大きく切れている画像
- UIが別ウィンドウや字幕で隠れている画像
- 極端に暗い、ぼやけている、圧縮が強い画像
- 対応していない盤面レイアウトの画像

## Privacy

画像解析はブラウザ内で行います。このサイト側のサーバーへ画像をアップロードする機能はありません。

作業状態は、続きから作業できるようにブラウザの `localStorage` に保存されます。サイト内の初期化操作で保存状態を削除できます。

## Feedback

不具合報告や改善要望は、GitHub Issuesで受け付ける予定です。

Issues: https://github.com/ofoblivion223-dotcom/arkpazle/issues

## Repository Layout

```txt
.
├── index.html
├── styles.css
├── app.js
├── assets/
│   └── 16285.png
└── docs/
    ├── DESIGN.md
    └── arknights-endfield-puzzle-requirements.md
```

## Disclaimer

このツールは非公式ファンツールです。ゲーム公式・権利元とは関係ありません。

解析結果の正確性は保証できません。利用は自己責任でお願いします。

## License

All rights reserved.

This repository is published for reference and issue tracking. Redistribution, sublicensing, or commercial use of the code, design, or bundled assets is not permitted without permission.
