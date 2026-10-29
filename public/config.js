// Config editabile: mappature e classificazioni di K-Claims.
// Modifica qui senza toccare il codice di app.js.

// ===== Gruppo -> membri =====
const GROUP_MEMBERS = {
  ATEEZ: ['Hongjoong', 'Seonghwa', 'Yunho', 'Yeosang', 'San', 'Mingi', 'Wooyoung', 'Jongho'],
  SKZ: ['Bangchan', 'LeeKnow', 'Changbin', 'Hyunjin', 'Han', 'Felix', 'Seungmin', 'Jeongin'],
  P1H: ['Keeho', 'Theo', 'Jiung', 'Intak', 'Soul', 'Jongseob'],
  WayV: ['Kun', 'Ten', 'Xiaojun', 'Hendery', 'YangYang'],
  'AMPERS&ONE': ['Kamden', 'Brian', 'Siyun', 'Kyrell', 'Mackiah', 'Seungmo', 'Jiho'],
  TXT: ['Soobin', 'Yeonjun', 'Beomgyu', 'Taehyun', 'Huening Kai'],
  BTS: ['RM', 'Jin', 'Suga', 'J-Hope', 'Jimin', 'V', 'Jungkook'],
  Xikers: ['Minjae', 'Junmin', 'Sumin', 'Jinsik', 'Hyunwoo', 'Junghoon', 'Seeun', 'Yujun', 'Hunter', 'Yechan'],
  'NCT 127': ['Taeyong', 'Johnny', 'Yuta', 'Doyoung', 'Jaehyun', 'Jungwoo', 'Mark', 'Haechan'],
  ALD1: ['Junseo', 'Arno', 'Leo', 'Geonwoo', 'Sangwon', 'Xinlong', 'Anxin', 'Sanghyeon'],
  LNGSHOT: ['Ohyul', 'Ryul', 'Woojin', 'Louis'],
};

// ===== Gruppo -> comeback =====
const GROUP_COMEBACKS = {
  ATEEZ: ['GHP4', 'GHP5', 'GHP6', 'ETERNAL SUNSHINE'],
  P1H: ['UNIQUE', 'BLOW UP'],
  BTS: ['ARIRANG'],
  'AMPERS&ONE': ['Definitions'],
  SKZ: ['DO IT'],
  WayV: ['Vision Wings'],
  TXT: ['Perfect Storm'],
  Xikers: ['ROUTE ZERO: The CALLING'],
  'NCT 127': ['Blingy'],
  LNGSHOT: ['S.W.I.S.H.'],
};

// ===== Classificazione status =====
const CANCELLED = new Set(['Cancelled']);
const DONE = new Set(['Received']);
const ARCHIVED = new Set(['Received', 'Cancelled', 'Gifted']);

// ===== Etichette categoria (badge e filtri) =====
const CAT_LABEL = { Album: 'album', POB: 'POB', Merch: 'merch', Altro: 'altro' };

// ===== Ordine di ordinamento degli status (numero più basso = prima) =====
const STATUS_RANK = {
  Claimed: 0, 'Claimed & Waiting': 0, 'Shipped to Proxy': 1, Kaddy: 2, 'Shipped to GOM': 3, GOM: 4,
  'Shipped to Friend': 5, 'Shipped to ME': 6, Received: 9, Gifted: 10, Cancelled: 11,
};
