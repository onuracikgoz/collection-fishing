# XP ve Level

> Kaynak: tasarım dokümanı v0.8, bölüm 6. Numaralar eski dokümana atıf için korunmuştur.

## 6. XP ve Level

- Her başarılı av XP verir. Nadir av daha çok, çöp az verir, kaçan balık vermez.
- Level şunları açar:
  - **Daha iyi oltalar:** daha uzağa atış, derin su havuzuna erişim. Bazı balıklar yalnızca derin suda çıkar.
  - **Yeni yem türleri:** farklı balık havuzlarına yönlendirir.
  - **Takas ve pazar** (ör. level 10). Bot önlemi olarak da çalışır.
- **Level drop şansını doğrudan artırmaz.** Şans bonusu defterden gelir; level de artırırsa yeni oyuncular çok geride kalır.
- Level profilde Collection Score'un yanında küçük bir rozet olarak görünür. Ana statü defterdir.
- XP'nin eşya değeriyle doğrudan bağı yoktur.

### Sayılar (Öneri, 29.10.2026)

- XP: çöp 1, malzeme 3, Common 10, Rare 25, recipe 40, Epic 60, Legendary 150, Mythic 400. Enerjisiz atışta XP yok.
- Level `n` → `n+1`: `250 + 250·n` XP. Level 10'a toplam 13.500 XP, en yüksek level 50.
- Level 10: takas açılır (`TRADE.minLevel`). Protokol: `docs/protokol.md` XP ve level.
- Sayılar `server/src/config.ts` `XP`; playtest sonrası ayarlanacak.
