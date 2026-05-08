# Wordle War

Çok oyunculu Türkçe Wordle oyunu — iki oyuncu gerçek zamanlı olarak yarışır, kim kelimeyi önce bulursa round'u kazanır.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API + Socket.IO sunucusu (port 8080)
- `pnpm --filter @workspace/wordle-war run dev` — React frontend (port 21116)
- `pnpm run typecheck` — tüm paketleri typecheck et
- `pnpm run build` — typecheck + build

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Socket.IO 4
- Frontend: React + Vite + Tailwind CSS + Framer Motion
- Gerçek zamanlı: WebSocket (socket.io)
- Kelime listesi: Türkçe (words.ts + common-words.ts)

## Where things live

- `artifacts/wordle-war/src/App.tsx` — tüm oyun UI (tek dosya)
- `artifacts/wordle-war/src/lib/socket.ts` — socket.io client bağlantısı
- `artifacts/wordle-war/src/types.ts` — Room, Player, Settings tipleri
- `artifacts/api-server/src/lib/socket-game.ts` — oyun mantığı (odalar, turlar, kelime değerlendirme)
- `artifacts/api-server/src/lib/words.ts` — tam Türkçe kelime listesi
- `artifacts/api-server/src/lib/common-words.ts` — sık kullanılan kelimeler (öncelikli havuz)
- `artifacts/api-server/.replit-artifact/artifact.toml` — /socket.io path dahil

## Architecture decisions

- Socket.IO WebSocket üzerinden çalışır; proxy'den geçmesi için artifact.toml'da `/socket.io` path'i eklenmiştir
- Kelime doğrulama sunucu tarafında yapılır (hile önleme)
- Gizli kelime client'a hiçbir zaman gönderilmez; sadece sonuç bilgisi (correct/present/absent) gönderilir
- Host bağlantısı kesilirse 30 sn, diğer oyuncular için 25 sn yeniden bağlanma süresi tanınır
- DB kullanılmıyor; tüm oyun state'i sunucu bellekte tutulur

## Product

- Oda oluştur (YENİ SAVAŞ BAŞLAT) veya kod ile katıl
- 2 oyuncu aynı anda 5 harfli Türkçe kelimeyi tahmin eder
- Kim önce bulursa round puanı kazanır
- Ayarlar: süre limiti, toplam round sayısı, zorluk seviyesi
- Rövanş teklifi sistemi, yeniden bağlanma desteği

## User preferences

_Populate as you build._

## Gotchas

- `/socket.io` path'i artifact.toml'da listelenmezse WebSocket bağlantısı proxy'den geçemez
- Kelime listesi büyük (words.ts ~84KB); esbuild bundle'ı ~2MB olur, normaldir
- DATABASE_URL gerekmez; oyun DB kullanmaz

## Pointers

- `pnpm-workspace` skill — monorepo yapısı
- `react-vite` skill — WebSocket proxy path notu
