export const PRIVACY_OPTIONS = [
  { v: "RT", label: "Warga RT Saya", hint: "Hanya warga di RT Anda" },
  { v: "VILLAGE", label: "Satu Kelurahan", hint: "Warga di kelurahan/desa Anda" },
  { v: "FOLLOWERS", label: "Pengikut", hint: "Hanya yang mengikuti Anda" },
];

export const PRIVACY_LABEL = Object.fromEntries(PRIVACY_OPTIONS.map((p) => [p.v, p.label]));

export const MUSIC_LIBRARY = [
  { title: "Pagi Ceria", url: "/music/pagi-ceria.wav" },
  { title: "Senja Tenang", url: "/music/senja-tenang.wav" },
  { title: "Gotong Royong", url: "/music/gotong-royong.wav" },
];

export const MAX_VIDEO_MB = 50;
