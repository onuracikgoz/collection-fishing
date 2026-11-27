# Ajanlar (agent-miner)

Yerel çoklu ajan kurulumu: planlayıcı, geliştirici ve test ajanı Mac'te tmux'ta çalışır, [agent-miner](https://github.com/onuracikgoz/agent-miner) dashboard'undan izlenir ve yönetilir. Görev panosundaki işleri planlayıcı dağıtır, test ajanı onaylayınca sıradakine geçilir. Merge'ü Onur elle yapar.

agent-miner genel bir araçtır, kendi reposunda durur. Bu repoda sadece oyuna özel parçalar var:

| Dosya | Ne |
|---|---|
| `.claude/agent-miner.json` | Ajanlar (planner, dev1, tester), test komutu, oyuna özel yasaklar (Unity'yi doğrudan çağırmak, `client/Library` ve `ProjectSettings` düzenlemek) |
| `.claude/agents/*.md` | Ajan tanımları: agent-miner şablonları + bu reponun kuralları |
| `tools/agents/testbed.sh` | Tek test klasörü: sunucu testleri ve Unity batch mode |
| `.claude/settings.json` | Herkes için güvenli komut izinleri (git status / diff / commit, `agent/*` push, `npm test`, `testbed.sh`) |

## Bir kerelik kurulum

```bash
brew install tmux
git clone https://github.com/onuracikgoz/agent-miner ~/myprojects/agent-miner
~/myprojects/agent-miner/bin/agent-miner install
cd ~/myprojects/collection-fishing
./cg testbed setup        # test klasörü: ../collection-fishing-testbed
```

İlk Unity testi test klasöründe Library/'yi baştan kurar (10-20 dk). Sonrakiler sadece değişeni import eder. Kendi Unity'n ana repodaki `client/`'ı açık tutabilir, test klasörü ayrı bir proje.

## Her gün

```bash
./cg agents up            # = agent-miner up: ajanlar + dashboard (http://127.0.0.1:7380)
./cg agents attach        # tmux panelleri
./cg agents down
./cg agents phone         # telefondan açmak için adres ve QR (Tailscale)
```

Dashboard, görev panosu, telefondan erişim, model seçme ve bütün komutlar: agent-miner README'si.

Akış: dashboard'da faz ve görev ekle (ya da planlayıcıya işi anlat, o böler) → **Dağıtımı başlat** → planlayıcı dev1'e görevi verir → dev1 kendi worktree'sinde (`../collection-fishing-worktrees/dev1`) `agent/T#-…` branch'ini açar, kodlar, `npm test`, push → tester `testbed.sh` ile test eder → geçerse görev "Test geçti, merge bekliyor" olur ve dev1'e sıradaki gelir. PR'ı açıp merge'lersin, görevi "Bitti"ye çekersin.

## Test klasörü

```bash
tools/agents/testbed.sh run <branch> [server|edit|play|all] [--filter TestAdı] [--wait]
tools/agents/testbed.sh status
```

- Branch'i `../collection-fishing-testbed`'de `--detach` ile açar. İzlenen değişiklikleri atar; `client/Library` ve `server/node_modules` kalır.
- `all` (varsayılan): `npm test` + Unity EditMode. `npm ci` sadece `package-lock.json` değişince.
- Aynı anda tek test (kilit). Meşgulse çıkış kodu 3, `--wait` sıraya girer.
- Çıkış kodu: 0 geçti, 1 kaldı, 2 hata (derleme hatası, Unity bulunamadı vb.).
- Sonuçlar `~/.agent-miner/projects/collection-fishing/tests/`; dashboard'un Testler tablosunda görünür.
- Unity yolu `client/ProjectSettings/ProjectVersion.txt`'ten bulunur, farklıysa `UNITY=/yol/Unity`.
- Unity'de henüz test assembly'si yok; ilk EditMode testleri eklenene kadar Unity adımı "derleniyor mu" kontrolüdür (0 test).
