// REVOLUTION DRIVE — STORY MODE (all characters, teams and dialogue are original)
// Season > arc (shown as a sphere) > episode (one battle vs a rival).
// p: portrait parameters for the generated face art (hair style/colour, skin, eyes, accessory)
export const SEASONS = [
  {
    id: 's1', title: 'SEASON 1', jp: '峠の目覚め',
    arcs: [
      {
        id: 'a1', title: '赤嶺の新星', sub: '編', level: '初級', color: 'blue',
        courseId: 'akane', dir: 'fwd', time: 'night', weather: 'clear',
        story: '赤嶺峠に現れた新しい走り屋。地元チーム「赤嶺ナイトキッズ」が黙っているはずがない──。',
        episodes: [
          { id: 'a1e1', title: '夜の挑戦状', tp: 5, credits: 600, rival: { name: 'ケンジ', team: '赤嶺ナイトキッズ', carId: 'sylph_180x', skill: 0.82, aggr: 0.3, tune: 0, p: { hair: 'spiky', hc: '#2a1a10', skin: '#f2c8a0', eye: '#3a2a1a', acc: 'none' } },
            intro: [['rival', 'おい、見ない顔だな。この峠はオレたちナイトキッズのシマだぜ。'], ['me', '走りに来ただけだ。文句があるなら、峠で聞く。'], ['rival', '上等だ!下りで勝負してやる。ついてこれるかな!']],
            win: 'くっ…ヘアピンの立ち上がりで離された…。お前、ただ者じゃねぇな。', lose: 'ハハッ、まだまだだな!出直してきな!' },
          { id: 'a1e2', title: 'ナイトキッズの意地', tp: 5, credits: 700, rival: { name: 'タクマ', team: '赤嶺ナイトキッズ', carId: 'ryujin_r5', skill: 0.85, aggr: 0.4, tune: 1, p: { hair: 'slick', hc: '#111', skin: '#e8b890', eye: '#222', acc: 'shades' } },
            intro: [['rival', 'ケンジを負かしたってのはお前か。'], ['rival', 'ロータリーの伸びを甘く見るなよ。トンネルを抜けたら勝負だ。'], ['me', '…いいぜ。']],
            win: 'ロータリーが…回し切れなかった…。', lose: '直線じゃロータリーには勝てねぇよ!' },
          { id: 'a1e3', title: '赤い夕陽', tp: 5, credits: 800, rival: { name: 'ミサキ', team: 'レッドサンセット', carId: 'tsubame_f', skill: 0.87, aggr: 0.35, tune: 2, p: { hair: 'long', hc: '#8a1a1a', skin: '#f6d2b0', eye: '#5a1a1a', acc: 'earring' } },
            intro: [['rival', 'ナイトキッズを2人抜きしたんですって?噂になってるわよ。'], ['rival', 'FFでも峠は速い。それを教えてあげる。'], ['me', '車種で勝負は決まらない。']],
            win: 'ふふ…完敗ね。リーダーのゴウに気をつけなさい。', lose: 'FFの軽さ、思い知ったかしら?' },
          { id: 'a1e4', title: '赤嶺の帝王', tp: 10, credits: 1500, boss: true, rival: { name: 'ゴウ', team: '赤嶺ナイトキッズ', carId: 'sora_gt3', skill: 0.9, aggr: 0.55, tune: 3, p: { hair: 'buzz', hc: '#3a3a3a', skin: '#d8a070', eye: '#111', acc: 'scar' } },
            intro: [['rival', 'うちの連中が世話になったな。'], ['rival', 'この赤嶺で、オレより速い奴はいない。5連続ヘアピン、ついて来い。'], ['me', '今夜、それを変えに来た。']],
            win: '…信じられねぇ。赤嶺の頂点は、今日からお前のものだ。', lose: '帝王の座は、まだ譲れねぇな。' },
        ],
      },
      {
        id: 'a2', title: '白波の稲妻', sub: '編', level: '中級', color: 'green',
        courseId: 'shiranami', dir: 'fwd', time: 'dusk', weather: 'clear',
        story: '赤嶺を制した噂は海沿いの尾根道まで届いた。高速コーナーの白波スカイラインで、新たな挑戦者が待つ。',
        episodes: [
          { id: 'a2e1', title: '尾根道の誘い', tp: 6, credits: 900, rival: { name: 'ハルカ', team: 'シーサイドウィング', carId: 'kurogane_s2', skill: 0.9, aggr: 0.4, tune: 3, p: { hair: 'bob', hc: '#e0c070', skin: '#f6d6b8', eye: '#2a5a8a', acc: 'none' } },
            intro: [['rival', 'あなたが赤嶺の新しい王様?ここは高速ステージよ。'], ['me', '速さはどこでも変わらない。'], ['rival', 'じゃあ、見せてもらおうかしら。']],
            win: 'アクセルを抜かないのね…!', lose: '高速コーナーはまだ早かったみたいね。' },
          { id: 'a2e2', title: '最新鋭の挑戦', tp: 6, credits: 1000, rival: { name: 'ジン', team: 'シーサイドウィング', carId: 'tsubame_86n', skill: 0.92, aggr: 0.45, tune: 3, p: { hair: 'messy', hc: '#4a3020', skin: '#efc49a', eye: '#3a2a1a', acc: 'cap' } },
            intro: [['rival', '古い車で勝てる時代じゃないんだよ。'], ['rival', '新型の低重心、思い知らせてやる。'], ['me', '大事なのはドライバーだ。']],
            win: '性能差を…腕で埋められた…。', lose: '最新型の勝ちってことさ!' },
          { id: 'a2e3', title: 'ドリフト王子', tp: 6, credits: 1100, rival: { name: 'レイ', team: 'スカイラインエンジェルス', carId: 'sylph_specr', skill: 0.93, aggr: 0.5, tune: 4, p: { hair: 'swept', hc: '#c8c8d0', skin: '#f8dcc4', eye: '#5a3a8a', acc: 'earring' } },
            intro: [['rival', '速いだけじゃ美しくない。峠は魅せてナンボさ。'], ['me', '勝てば、それでいい。'], ['rival', 'フッ…その考え、今日で変えてあげるよ。']],
            win: '速くて…しかも美しい走りだった。', lose: '魅せる走り、少しは学んだかい?' },
          { id: 'a2e4', title: '白波の稲妻', tp: 12, credits: 2000, boss: true, rival: { name: 'ライデン', team: 'スカイラインエンジェルス', carId: 'sora_gt4', skill: 0.95, aggr: 0.6, tune: 5, p: { hair: 'spiky', hc: '#e8c020', skin: '#e8b890', eye: '#1a3a6a', acc: 'none' } },
            intro: [['rival', '白波の稲妻──そう呼ばれてる。'], ['rival', '4WDターボのトラクション、雷みたいに一瞬で抜き去ってやる。'], ['me', '雷だろうと、捕まえてみせる。']],
            win: '稲妻が…捕まった…。お前の名前、覚えておく。', lose: '雷には追いつけねぇよ。' },
        ],
      },
      {
        id: 'a3', title: '霞湖の亡霊', sub: '編', level: '上級', color: 'orange',
        courseId: 'kasumi', dir: 'fwd', time: 'night', weather: 'clear',
        story: '霞湖峠には、霧の夜にだけ現れる「亡霊」がいるという。その正体を確かめるため、山頂の湖へ向かう。',
        episodes: [
          { id: 'a3e1', title: '霧の湖畔', tp: 7, credits: 1200, rival: { name: 'ユウ', team: '霞湖ロータリーズ', carId: 'ryujin_r7', skill: 0.95, aggr: 0.5, tune: 5, p: { hair: 'short', hc: '#1a1a2a', skin: '#f0c8a0', eye: '#1a1a1a', acc: 'glasses' } },
            intro: [['rival', '亡霊に会いたいなら、まずオレを倒すことだ。'], ['me', '道を開けてもらう。']],
            win: '…あの人に会う資格はあるみたいだ。', lose: '霞湖のヘアピンは甘くないよ。' },
          { id: 'a3e2', title: '水平対向の鼓動', tp: 7, credits: 1300, rival: { name: 'サクラ', team: '霞湖ロータリーズ', carId: 'aoba_skybolt', skill: 0.96, aggr: 0.5, tune: 5, p: { hair: 'pony', hc: '#d07a9a', skin: '#f8dcc4', eye: '#7a2a4a', acc: 'none' } },
            intro: [['rival', 'このボクサーサウンド、聞こえる?'], ['rival', '5連続ヘアピンで、置いていくから。'], ['me', '受けて立つ。']],
            win: '負けちゃった…。カゲさんは、この先の側溝を使うよ。', lose: '鼓動が聞こえなくなるまで離してあげた!' },
          { id: 'a3e3', title: '4ドアの刺客', tp: 7, credits: 1400, rival: { name: 'シン', team: '湖畔セダンクラブ', carId: 'kurogane_seiran', skill: 0.97, aggr: 0.55, tune: 6, p: { hair: 'slick', hc: '#2a2a2a', skin: '#e0b08a', eye: '#111', acc: 'shades' } },
            intro: [['rival', 'セダンだからって舐めるなよ。'], ['rival', 'この長いホイールベースで、ヘアピンを角度つけて抜ける。'], ['me', '角度より、速さで勝つ。']],
            win: '直6ターボが…完敗だ。', lose: 'セダンの底力、見たか!' },
          { id: 'a3e4', title: '霞湖の亡霊', tp: 15, credits: 2600, boss: true, rival: { name: 'カゲ', team: '???', carId: 'kazemoto_ev9', skill: 0.99, aggr: 0.6, tune: 7, p: { hair: 'hood', hc: '#111', skin: '#c89070', eye: '#c02020', acc: 'mask' } },
            intro: [['rival', '……'], ['rival', '……ここまで来たか。霧の向こうへ、ついて来られるなら。'], ['me', 'あんたが、亡霊の正体か。']],
            win: '…霧が晴れたようだ。お前なら、流星に届くかもしれない。', lose: '……霧の中に消えろ。' },
        ],
      },
      {
        id: 'a4', title: '流星の頂点', sub: '編', level: '超上級', color: 'red',
        courseId: 'ryusei', dir: 'fwd', time: 'night', weather: 'rain',
        story: '山頂の周回路「流星サーキット」。雨の夜、すべての峠の頂点に立つ者たちが集う。',
        episodes: [
          { id: 'a4e1', title: '雨の周回路', tp: 8, credits: 1600, rival: { name: 'マコト', team: 'メテオフォース', carId: 'sora_gt5', skill: 0.99, aggr: 0.6, tune: 7, p: { hair: 'messy', hc: '#3a2010', skin: '#efc49a', eye: '#2a1a0a', acc: 'cap' } },
            intro: [['rival', '雨の流星へようこそ。ここから先は本物しかいない。'], ['me', 'そのために来た。']],
            win: '雨でもブレないな…。', lose: '雨の流星は、甘くない。' },
          { id: 'a4e2', title: '電光石火', tp: 8, credits: 1700, rival: { name: 'アヤ', team: 'メテオフォース', carId: 'tsubame_arc', skill: 1.0, aggr: 0.6, tune: 7, p: { hair: 'long', hc: '#1a1a1a', skin: '#f8dcc4', eye: '#1a3a7a', acc: 'earring' } },
            intro: [['rival', 'モーターの即応トルク、雨でも関係ないわ。'], ['me', '雨なら、なおさら腕の差が出る。']],
            win: 'まさか、この車で負けるなんて…。', lose: 'ハイブリッドの時代よ。' },
          { id: 'a4e3', title: '黒い翼', tp: 8, credits: 1800, rival: { name: 'クロウ', team: 'ブラックウイング', carId: 'kurogane_supreme', skill: 1.0, aggr: 0.7, tune: 8, p: { hair: 'swept', hc: '#111', skin: '#e0b08a', eye: '#6a0a0a', acc: 'scar' } },
            intro: [['rival', 'オレの後ろに付いた奴は、みんな消えていった。'], ['me', 'なら、前に出るまでだ。']],
            win: '黒い翼が…折れた…。セイヤが待ってる。', lose: '消えな。' },
          { id: 'a4e4', title: '流星の王', tp: 20, credits: 4000, boss: true, rival: { name: 'セイヤ', team: 'メテオフォース', carId: 'ryujin_scarlet', skill: 1.03, aggr: 0.75, tune: 10, p: { hair: 'swept', hc: '#f0f0f0', skin: '#f6d2b0', eye: '#b08a20', acc: 'none' } },
            intro: [['rival', 'すべての峠を越えて、ここまで来たか。'], ['rival', 'V12の咆哮を聞きながら、雨の中で決着をつけよう。'], ['me', 'この夜を、伝説にする。']],
            win: '見事だ…。今日から、流星の頂点はお前だ。SEASON 1 ── 完。', lose: '頂点は、そう簡単には揺るがない。' },
        ],
      },
    ],
  },
];

export const allEpisodes = () => SEASONS.flatMap(s => s.arcs.flatMap(a => a.episodes.map(e => ({ season: s, arc: a, ep: e }))));
export const findEpisode = (id) => allEpisodes().find(x => x.ep.id === id);
// story rank: 1 + floor(points / 200); each first clear = 100 pts (boss 200)
export const storyRank = (pts = 0) => ({ rank: 1 + Math.floor(pts / 200), next: 200 - (pts % 200), progress: (pts % 200) / 200 });
