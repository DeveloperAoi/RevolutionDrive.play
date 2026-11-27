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
| ゴースト / ラインガイド | G / L | — |
| ポーズ | ESC | START |

スマートフォンでは画面上のタッチボタンで操作できます。

## 現在のコンテンツ(Ver.1.30 "FIRST IGNITION")

- **モード**: TIME TRIAL(ゴースト・セクションタイム・自己ベスト)、COURSE BATTLE(CPU 4段階)、SPECIAL(期間限定チャレンジ)
- **準備中**: STORY / LOCAL BATTLE / ONLINE BATTLE(CODE BATTLE・WORLDWIDE MATCH)
- **コース**: 赤嶺峠・白波スカイライン・流星サーキット・霞湖峠(各 上り/下り、晴れ/雨、夜/夕方/昼)
- **車両**: 架空メーカー6社・14車種(FR/FF/4WD、直4/直6/ロータリー/水平対向、NA/ターボ)。車種ごとに固有のシルエット・ライト形状
- **走行物理 v2**: 前後輪の回転数を状態に持つ複合スリップモデル(アクセルで空転量→横グリップが連続的に変化)、ブレーキ荷重移動、サイドブレーキ、ABS、ドリフトアシスト
- **エンジン音**: AudioWorkletによる燃焼パルス合成(点火順序・排気共鳴・負荷・リミッター・アフターファイア)、ドリフトスキール、カーブ案内SE
- **ガレージ**: 最大5台登録(追加・削除・使用車切替)、車両ごとに個別保存
- **DRESS UP**: ボディカラー24色 × 仕上げ(グロス/メタリック/パール/マット)、バイナルステッカー(サイド/ボンネット/リア/ストライプ、位置・サイズ・角度調整)、
  エアロ9部位(フロントスポイラー/リップ/サイドスカート/リアバンパー/リアスポイラー/ウイング/ボンネット/カナード/オーバーフェンダー、車種別の装着可否)、マフラー、車高
- **WHEEL**: 架空ブランド4社・9デザイン、ホイールカラー/リムカラー、15〜19インチ、オフセット、タイヤ外観、前後別設定
- **METER**: 8デザイン(DEFAULT/INFINITY/FORMULA/FUTURE/DIGITAL/CLASSIC/SPORT/RACING)× 背景・文字色・照明。レースHUDに反映
- **IN-STORE**: エアロ・吸気・インタークーラー・キャリパー・車高調・マフラー・ホイール・ステッカーを購入(全車共通)。装着パーツは性能にも反映
- **TUNING**: 6カテゴリ17パーツ、各Lv.1〜5、チューニングポイント(レース完走・タイムアタック・イベントで獲得)。走行挙動に反映
- **RACE HUD**: モード別HUD(タイムアタック / バトル)、コーナー警告標識(曲率から自動判定)、回転ミニマップ、相手の順位タグ、ADVANTAGE、区間タイム(自己ベスト比で色分け)、目標タイム、入力表示、車両コンディション、ドリフト擬音
- **GHOST / LINE GUIDE**: 自己ベストの実走行データを再生(距離差・タイム差表示)、加減速プラン付き走行ライン。G / L キーまたはタップで切替、透明度・色・カメラ揺れはSETTINGSで保存
- カスタマイズ画面は3分タイマー(時間切れで自動保存、SETTINGSで無効化可)

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

## オンライン対戦(Ver.1.50〜)
- WORLDWIDE MATCH(自動マッチング)と CODE BATTLE(6桁のルームコード)に対応。
- 走行データは WebRTC(P2P)で送受信。マッチングと接続情報の受け渡しは Cloud Firestore の `rooms` コレクションで行います。直接つながらない環境では Firestore 経由のリレー(低速)に自動で切り替わります。
- 必要な Firebase 設定:
  1. Authentication → Sign-in method → **匿名(Anonymous)** を有効化(ゲストでの対戦用)
  2. `firebase/firestore.rules` を Firestore のルールに貼り付けて公開

## 外部3Dモデル(GLB)の車
`js/data/glbcars.js` にパックを登録し、`js/data/cars.js` の車に `model: { pack, node }` を指定すると、その3Dモデルで表示されます(タイヤの自動分割、塗装色の変更、ライトに対応)。公開ゲームで再配布できるライセンスのもの、かつ実在の市販車ではないものを使用してください。

## クレジット
- 3D car models: "Ultimate Low-Poly Car Pack" by ProbablyNotG (https://sketchfab.com/mr_c0neDude) — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source: https://sketchfab.com/3d-models/ultimate-low-poly-car-pack-fadf9f031dbc4da384dc2593394f81dd (ゲーム内の車名・性能は架空のものです)
- KAZE RS model: based on "Toyota Corolla AE86 Trueno" by Lexyc16 (https://sketchfab.com/Lexyc16) — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source: https://sketchfab.com/3d-models/toyota-corolla-ae86-trueno-fe02fba6302e450ea8424591493341ea. Modified: maker lettering, number plate and door decal removed; pop-up lamps animated in-game.
- Aero parts (rear wings, front splitter, canards, carbon texture): parts model packs supplied by the project owner (Roblox Studio exports), converted to `assets/parts/aero_parts.glb`.
- Wheels & tyres: "Wheel, Tire Pack" model pack supplied by the project owner (Roblox Studio export), converted to `assets/parts/wheel_pack.glb`.
- Body kit (front/rear bumpers, bonnets, side skirts): 12 `bodyPart_*.glb` models supplied by the project owner (no licence/author metadata in the files), decimated and merged into `assets/parts/body_parts.glb`.
