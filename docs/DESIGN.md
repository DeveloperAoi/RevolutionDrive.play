# REVOLUTION DRIVE — 設計書

## 1. コンセプト
日本の峠を舞台にしたアーケード・ドリフトレーシング。ゲームセンターの筐体を起動したときの体験
(INITIALIZING → アトラクト → エントリー → カード確認 → モード選択)をブラウザで再現する。
既存作品の素材・ロゴ・キャラクター・実在車の意匠は一切使わない。

## 2. 技術構成
| 領域 | 採用 | 備考 |
|---|---|---|
| 描画 | Three.js r170(同梱) | import map、ビルド工程なし |
| 物理 | 自作 2軸車両モデル | Pacejka風タイヤ、荷重移動、摩擦円、FR/FF/4WD、エンジン・ギア |
| コース | セグメント定義 → サンプル列 | クロソイド風平滑化、バンク、上り/下り反転 |
| 景観 | プロシージャル | 地形・擁壁・ガードレール・街灯(ライトプールを頂点に焼き込み)・樹木・トンネル・標識・雨 |
| 音 | Web Audio 合成 | 気筒数・エンジン形式別のエンジン音、スキール、衝突、BOV、BGMシーケンサ |
| UI | DOM(1920×1080仮想ステージをスケール) | キーボード/マウス/タッチ/ゲームパッド |
| 保存 | IndexedDB / Firestore | オートセーブ、同期失敗時は再送キュー |
| 認証 | Firebase Authentication | メール+パスワード、IndexedDB永続化 |

## 3. 画面遷移
```
INITIALIZING → TITLE ⇄ ATTRACT(デモ走行)
TITLE → ENTRY(GUEST / ACCOUNT) → [ACCOUNT: login/register/reset]
      → DATA CHECK(既存データ: YES/NO、最大3スロット、上書き時は二重確認)
         YES → PLAYER INIT → MODE SELECT
         NO  → NAME ENTRY(ドライバー名/チーム名/アイコン) → PLAYER INIT
               → CAR SELECT(初回登録) → DRESS UP → 登録完了 → MODE SELECT
MODE SELECT → TIME TRIAL / COURSE BATTLE → COURSE SELECT(方向・天候・CPU) → RACE → RESULT
            → SPECIAL → RACE → RESULT
            → GARAGE(使用車・追加(最大5台)・削除・ドレスアップ・チューニング)
            → PROFILE(アカウント状態・同期・ログアウト・削除) / SETTINGS
```

## 4. データ
プロフィール(1スロット):
```
{ id, owner, driverName, teamName, icon, credits, rp, xp,
  cars: [{ uid, carId, name, maker, drive, hp, disp, tune{}, dress{}, setup{}, owned{}, registeredAt }],
  activeCar, unlocked{courses[]}, records{"course:dir": {best, sections[]}}, stats{}, settings{}, flags{} }
```
- GUEST: IndexedDB `profiles` に `guest/<id>`
- ACCOUNT: Firestore `users/{uid}/profiles/{id}` + IndexedDB キャッシュ `uid:<uid>/<id>`
- ゴースト: IndexedDB `ghosts`(ローカルのみ)
- ゲスト→アカウント引き継ぎ: コピーして新スロット化、ゲスト側は `migratedTo` を付けて保持(削除しない・二重移行防止)

## 5. 物理モデル要点
- 前後軸ごとの横力 `Fy = -μFz·sin(C·atan(Bα))`、縦方向は駆動/制動
- 縦荷重移動 `ΔFz = m·ax·h/L`、横荷重移動はタイヤ荷重感度として最大グリップを減衰
- 摩擦円: 駆動・制動・サイドブレーキが横グリップを奪う → パワーオーバー/サイドブレーキドリフト
- 速度感応ステア(高速ではグリップ限界付近まで)、カウンターステア補助・トラクション補助(DRIFT ASSIST設定)
- エンジン: トルクカーブ、クラッチ滑り、レブリミッター、ターボラグ、エンジンブレーキ、AT/MT
- CPU: 曲率から目標速度と制動点を計算、レーシングラインを追従、安定化補助つき

## 6. 今後
STORY(チャプター・ライバル)、ONLINE(CODE BATTLE: Realtime Database のルーム / WORLDWIDE MATCH: ランク別キュー)、
LOCAL BATTLE、ランキング(Firestore)、メーターカスタマイズ、詳細ドレスアップ、追加コース(市街地・雪道)。
