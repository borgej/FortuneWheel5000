// App configuration
const APP_CONFIG = {
  // Requires Twitch Client ID + OAuth (moderator:read:followers scope)
  enableFollowerInfo: true,
  clientId: '__TWITCH_CLIENT_ID__',
  version: 'v1.1',
  // Explicit redirect URI — must match exactly what is registered in dev.twitch.tv.
  // Set to null to use window.location.origin + pathname automatically (local dev).
  redirectUri: 'https://www.bjsolutions.no/FortuneWheel5000',
  donate: {
    enabled: true,
    url: 'https://paypal.me/borgej',
    label: 'Donate'
  },
  // Set to false when you dont want to test anymore
  ui: {
    showAddTestParticipants: true
  },
  features: {
    confetti: true,
    sad: true,
    tick: false
  },
  defaults: {
    // Optional: set a default channel to prefill the input
    channelName: '',
    keywordPrefix: '!',
    keywordText: 'wheel',
    winnerTimerMinutes: 2,
    entryTimerMinutes: 0,
    // New: wheel behavior defaults
    spinDurationSeconds: 15,
    spinSmoothEasing: true
  }
};

// ---------------------------------------------------------------------------
// Wheel colour palettes — all chromakey-safe (no greens/teals).
// Sourced from colorkit.co/palettes/
// ---------------------------------------------------------------------------
const WHEEL_PALETTES = [
  // Reds
  { name: 'Blood Moon',     colors: ['#0d0000','#3d0000','#6b0000','#8b0000','#b22222','#cc2200','#e03000','#ff4500'] },
  { name: 'Volcano',        colors: ['#6a040f','#9d0208','#d00000','#dc2f02','#e85d04','#f48c06','#faa307','#ffba08'] },
  { name: 'Dark Carnival',  colors: ['#1a0533','#6b0f1a','#b91c1c','#d97706','#92400e','#7c3aed','#be185d','#dc2626'] },
  // Warm oranges / earth tones
  { name: 'Hot Summer',     colors: ['#ff4e00','#fe6d00','#ff9500','#ffb700','#ff0054','#ff5400','#ea3546','#ffd500'] },
  { name: 'Autumn Harvest', colors: ['#582f0e','#7f4f24','#936639','#d4a373','#e9c46a','#f4a261','#e76f51','#c1440e'] },
  { name: 'Candlelight',    colors: ['#1a0a00','#3d1c02','#7b3a0a','#b5621e','#d4872c','#f0a830','#f5c050','#fad878'] },
  { name: 'Vintage Sepia',  colors: ['#2c1503','#6b3f0a','#a0522d','#c68642','#d4a574','#e8c99a','#f0dfc0','#f5e6d3'] },
  { name: 'Gold Rush',      colors: ['#7b4400','#a05c00','#c97d00','#e8a400','#f5c400','#ffd700','#ffe766','#fff0a0'] },
  // Pinks / rose
  { name: 'Rose Gold',      colors: ['#590d22','#a4133c','#ff4d6d','#ff85a1','#ffc8dd','#ff8c00','#e65c00','#ffb347'] },
  { name: 'Bubblegum',      colors: ['#ff6b9d','#ff8fab','#ffb3c1','#ff4d6d','#c9184a','#f72585','#ff85a1','#ffccd5'] },
  { name: 'Cotton Candy',   colors: ['#ffb3c6','#ff85a1','#ffc8dd','#ffafcc','#d4a5ff','#bde0fe','#ffcfd2','#f4acb7'] },
  { name: 'Pastel Candy',   colors: ['#ffadad','#ffd6a5','#fdffb6','#fbe0e0','#bdb2ff','#ffc8dd','#ffafcc','#e5d4ef'] },
  // Vivid mixed / hot pink
  { name: 'Retro 80s',      colors: ['#ff0080','#ff4d9d','#ffd700','#ff6600','#cc0066','#9900cc','#6600ff','#ff99c8'] },
  { name: 'Lava Lamp',      colors: ['#ff595e','#ff924c','#ffca3a','#c77dff','#9b5de5','#f15bb5','#fee440','#fb5607'] },
  { name: 'Neon Arcade',    colors: ['#ff006e','#fb5607','#ffbe0b','#8338ec','#3a86ff','#ff4d6d','#c77dff','#ffd166'] },
  { name: 'Miami Vice',     colors: ['#ff6ec7','#ff42a1','#d4007a','#0084c8','#00b4d8','#48cae4','#ff87c3','#90e0ef'] },
  // Magentas / purples
  { name: 'Jewel Tones',    colors: ['#e40066','#9b1d6a','#6a1277','#3d1199','#1a237e','#b5179e','#c77dff','#f72585'] },
  { name: 'Infrared',       colors: ['#2d0037','#4a0050','#800080','#b300b3','#cc0000','#e60000','#ff3300','#ff6600'] },
  { name: 'Cyberpunk',      colors: ['#120458','#4c0070','#8b00ff','#b200ff','#ff00ff','#ff2975','#f6019d','#fdff00'] },
  { name: 'Royal Court',    colors: ['#1a0050','#2d006e','#4a007e','#6b0094','#ffd700','#ffbf00','#e6a800','#c49000'] },
  { name: 'Deep Space',     colors: ['#10002b','#240046','#3c096c','#5a189a','#7b2fbe','#9d4edd','#c77dff','#e0aaff'] },
  // Blues
  { name: 'Moody Sunset',   colors: ['#00202e','#2c4875','#8a508f','#bc5090','#ff6361','#ff8531','#ffa600','#ffd380'] },
  { name: 'Midnight Jazz',  colors: ['#1b1b2f','#162447','#1f4068','#1b262c','#e43f5a','#f5a623','#c94b4b','#4b1248'] },
  { name: 'Nordic Blue',    colors: ['#03045e','#023e8a','#0077b6','#1a56db','#4361ee','#4895ef','#90c2ff','#c8deff'] },
  { name: 'Arctic Frost',   colors: ['#e8f4ff','#c8e0f5','#a8cce9','#87aced','#6690d9','#4470c4','#2255a4','#0a3880'] },
  { name: 'Copper & Navy',  colors: ['#0b3954','#1a4f72','#2e86ab','#a23b72','#f18f01','#c73e1d','#3b1f2b','#e76f51'] },
  // Complementary / mixed
  { name: 'Ice & Fire',     colors: ['#c1121f','#e63946','#f4a261','#ffb703','#8ecae6','#219ebc','#a8dadc','#90e0ef'] },
  { name: 'Candy Stripe',   colors: ['#e63946','#f1a1a8','#457b9d','#a8dadc','#e76f51','#ffd166','#ef476f','#06d6a0'] },
  // Rainbow / greyscale
  { name: 'Twitch Glow',    colors: ['#ef4444','#f97316','#f59e0b','#fb923c','#fca5a5','#f472b6','#ec4899','#d946ef','#a855f7','#8b5cf6','#6366f1','#3b82f6','#60a5fa','#93c5fd'] },
  { name: 'Monochrome',     colors: ['#111111','#2d2d2d','#4a4a4a','#6b6b6b','#929292','#b8b8b8','#d4d4d4','#f0f0f0'] },
];
