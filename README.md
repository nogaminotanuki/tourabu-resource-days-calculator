# 刀剣乱舞ONLINE 資源貯蓄日数計算ツール

現在の4資源から目標まで、日課と1日の遠征プランを繰り返した場合の必要日数を計算する静的Webツールです。

## 開発

```sh
npm ci
npm run dev
```

- `npm test`: 計算ロジックの検算
- `npm run build`: 公開用ファイルを `dist` に生成

## 公開

`main` ブランチへの更新時に、GitHub Actionsがテストとビルドを実行し、GitHub Pagesへ公開します。

GitHubのリポジトリ設定で、PagesのSourceを「GitHub Actions」に設定してください。

## 情報源

- [刀剣乱舞ONLINE 公式サイト](https://www.toukenranbu.jp/)
- ゲーム内「指南」

本ツールは非公式のファンツールです。
