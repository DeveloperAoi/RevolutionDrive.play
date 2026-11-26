# REVOLUTION DRIVE

峠を駆けるアーケードドリフトレーシング。ブラウザだけで無料で遊べます(課金なし)。

- 3D描画: [Three.js](https://threejs.org/) r170(`lib/` に同梱。ビルド不要)
- 車両物理・コース生成・サウンド: すべて自作(素材ファイルなし、実行時に生成)
- セーブ: ゲストは IndexedDB、アカウントは Firebase(Authentication + Firestore)

## 遊び方

GitHub Pages(Settings → Pages → Branch: `main` / root)で公開すると、`index.html` がそのまま動きます。
ローカルで試す場合は、任意の静的サーバーで配信してください(ES Modules のため `file://` では動きません)。

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

### 操作

| 操作 | キーボード | ゲームパッド |
|---|---|---|
| ステアリング | ← → / A D | 左スティック |
| アクセル | ↑ / W | RT |
| ブレーキ・バック | ↓ / S | LT |
| サイドブレーキ | SPACE | A |
| シフトアップ/ダウン(MT時) | E / Q | RB / LB |
| カメラ切替 | C | — |
| コース復帰 | R | — |
| ポーズ | ESC | START |

スマートフォンでは画面上のタッチボタンで操作できます。

## 現在のコンテンツ(Ver.1.00)

- **モード**: TIME TRIAL(ゴースト・セクションタイム・自己ベスト)、COURSE BATTLE(CPU 4段階)、SPECIAL(期間限定チャレンジ)
- **準備中**: STORY / LOCAL BATTLE / ONLINE BATTLE(CODE BATTLE・WORLDWIDE MATCH)
- **コース**: 赤嶺峠・白波スカイライン・流星サーキット(各 上り/下り・逆走方向、晴れ/雨)
- **車両**: 架空メーカー5社・6車種(FR/FF/4WD、NA/ロータリー/ターボ)
- **ガレージ**: 最大5台登録、ドレスアップ、チューニング

## Firebase の設定(アカウント機能)

1. Firebase コンソールでプロジェクトを作成し、ウェブアプリを追加
2. `js/net/firebase-config.js` の `firebaseConfig` に設定値を貼り付け(公開しても問題ない識別子です)
3. Authentication → メール/パスワード を有効化
4. Firestore を作成し、`firebase/firestore.rules` の内容をルールに貼り付けて公開

設定するまでは GUEST PLAY のみで動作します。

## 構成

```
index.html            エントリ
css/arcade.css        アーケードUI
js/main.js            起動・メインループ
js/app.js             共有コンテキスト
js/core/              入力・セーブ(IndexedDB/クラウド同期)
js/physics/           車両物理
js/world/             コース生成・景観・車両モデル・テクスチャ
js/game/              レース進行・AI・HUD・3Dビュー
js/ui/                画面(スタート / メニュー / レース)
js/audio/             エンジン音・効果音・BGM(Web Audio 合成)
js/net/               Firebase
js/data/              車両・コースデータ
firebase/             セキュリティルール
docs/DESIGN.md        設計書
```

収録されている車両・メーカー・コース・名称はすべて架空のものです。
