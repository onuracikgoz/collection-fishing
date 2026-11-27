# Ajanlar ve ajan dashboard'u

Mac'te yerelde çalışan üç Claude Code ajanı (planner, developer, tester) ve hepsini tek ekranda izleyip yönettiğin bir dashboard. Her ajan kendi tmux penceresinde `claude --agent <rol>` ile çalışır. Merge'ü sen elle yaparsın.

```
            sen (dashboard: http://127.0.0.1:7380, ya da tmux)
             │ prompt                │ prompt               │ prompt
         planner                  dev1                    tester
     (ana repo, sadece      (kendi worktree'si,      (ana repo; testleri
      görev dosyası yazar)   kod + npm test, push)    test klasöründe koşar)
             │                     │                        │
   ~/.cg-agents/tasks/*.md   agent/<NNN>-<ad> branch   collection-fishing-testbed/
                                                       (kalıcı client/Library, tek seferde tek test)
```

## Bir kerelik kurulum

```bash
brew install tmux
cd ~/myprojects/collection-fishing
./cg testbed setup        # test klasörünü oluşturur: ../collection-fishing-testbed
```

İlk Unity testi test klasöründe Library/'yi baştan kurar (10-20 dk). Sonraki testler sadece değişeni import eder. Kendi Unity'n ana repodaki `client/`'ı açık tutabilir, test klasörü ayrı bir proje olduğu için çakışmaz.

## Her gün

```bash
./cg agents up            # tmux'ta ajanları ve dashboard'u başlatır, tarayıcıyı açar
./cg agents attach        # panelleri görmek istersen (Ctrl-b n / p: sonraki / önceki, Ctrl-b d: çık, ajanlar çalışmaya devam eder)
./cg agents stop dev1     # tek ajanı kapat
./cg agents down          # hepsini kapat
```

Tipik akış:

1. Dashboard'da planner'a yaz: "Faz 5 için pazar panosu ilanlarını görevlere böl."
2. Planner `~/.cg-agents/tasks/007-market-listing.md` gibi dosyalar yazar.
3. dev1'e yaz: "007'yi yap." Kendi worktree'sinde `agent/007-market-listing` branch'ini açar, kodlar, `npm test` çalıştırır, push'lar.
4. tester'a yaz: "agent/007-market-listing'i test et." Test klasöründe sunucu testleri ve Unity EditMode'u çalıştırır, raporlar. Sonuç dashboard'un alt tablosunda da görünür.
5. Geçtiyse GitHub'da PR açıp sen merge'lersin. Yeni göreve başlamadan önce ajana `/clear` yazmak bağlamı ve parayı korur.

## Dashboard

`./cg agents up` açar, ya da tek başına: `./cg agents-dash` → http://127.0.0.1:7380

Her ajan için: durum (Çalışıyor / Seni bekliyor / Boşta / Kapandı), şu an ne yaptığı (hangi komut, hangi dosya), bağlam doluluğu, bu oturumun, bugünün ve toplam maliyeti, model, branch, son prompt ve son olaylar. Seni bekleyen ajanın kartı kırmızı yanar, sekme başlığında sayısı yazar. Üst barda planın 5 saatlik ve haftalık limiti (Claude Code bu bilgiyi verdiği sürece).

Kartın altından:
- **Model**: çalışan ajanın modelini değiştirir (aşağıda).
- **Gönder** (⌘ + Enter): prompt'u ajanın paneline yazar ve gönderir. Çok satırlı olabilir, `/clear` gibi komutlar da çalışır.
- **Onayla (Enter)**: izin sorusunda seçili seçeneği (genelde "Yes") onaylar. **Durdur (Esc)**: çalışan turu keser ya da izni reddeder.
- **Ekranı göster**: tmux panelinin son 60 satırını canlı gösterir.

Maliyet notu: Pro planında token başına ödeme yapmazsın. Gösterilen dolar, Claude Code'un hesapladığı API karşılığıdır, hangi ajanın ne kadar yük bindirdiğini karşılaştırmak için. Asıl sınır üst bardaki plan limitleridir.

### Veri nerede

Veritabanı yok, her şey `~/.cg-agents/` altında JSON:

| Dosya | Yazan |
|---|---|
| `agents/<ad>/hook.json` | Claude Code hook'ları (`tools/agents/hook.mjs`): durum, aktivite, son prompt, tmux paneli |
| `agents/<ad>/status.json` | Statusline (`tools/agents/statusline.mjs`): model, bağlam, maliyet, plan limitleri |
| `agents/<ad>/sessions/<oturum>.json` | Oturum başına maliyet; toplamlar bunlardan |
| `agents/<ad>/events.jsonl` | Son olaylar (kendini kırpar) |
| `tests/<id>.json` ve `tests/<id>/` | Test klasörü koşuları ve logları |
| `tasks/*.md` | Planner'ın görev dosyaları |
| `dash-token` | Telefondan erişim token'ı |
| `claude-settings.json` | `agents.sh`'ın ürettiği hook, statusline ve ajan yasakları (`--settings` ile verilir) |

Hook'lar sadece `./cg agents up` ile açılan ajanlarda çalışır. Kendi elle açtığın `claude` oturumları dashboard'a girmez.

### Telefondan

Dashboard prompt gönderebildiği için internete açılmaz. Telefon, Mac'e Tailscale üzerinden bağlanır (ücretsiz, kendi cihazların arasında özel bir ağ kurar).

Bir kerelik:
1. Mac'e Tailscale kur (App Store ya da `brew install --cask tailscale`), aç ve giriş yap.
2. Telefona Tailscale uygulamasını kur, aynı hesapla giriş yap.
3. İsteğe bağlı: `brew install qrencode` (adresi QR kod olarak basar).

Sonra:

```bash
./cg agents up      # Tailscale açıksa dashboard Tailscale adresini de dinler
./cg agents phone   # telefon adresini ve QR kodunu yazar
```

Telefonda kamerayla QR'ı okut ya da adresi aç (`http://100.x.y.z:7380/?token=…`). Bir kez açınca token çerezde kalır, ana ekrana ekleyebilirsin. Telefonun Tailscale'i açık olduğu sürece evde de dışarıda da (mobil veride) çalışır; Mac açık ve uyanık olmalı.

Güvenlik: Mac'in kendi tarayıcısı token istemez. Tailscale adresinden gelen her istek token ister; token `~/.cg-agents/dash-token`'da, yenilemek için dosyayı silip `./cg agents phone` çalıştır. GitHub Pages bu iş için uygun değil: oradaki sayfa Mac'teki tmux'a ulaşamaz.

### Model seçme

- Başlangıç modeli: `.claude/agents/<rol>.md` içindeki `model:` ya da `agents.conf`'taki son sütun (`haiku`, `sonnet`, `opus`; `-` dosyadaki varsayılan).
- Çalışırken: dashboard kartındaki **Model** listesinden seç. Dashboard ajanın paneline `/model <ad>` yazar; ajan o turu bitirmeden değişmez. Pro planında Opus limiti hızlı doldurur, uzun işlerde Sonnet daha güvenli.

## Ajanlar ve izinler

Tanımlar `.claude/agents/`:

| Ajan | Model | Klasör | Yapabildikleri |
|---|---|---|---|
| planner | sonnet | ana repo | Okur, `~/.cg-agents/tasks/` altına görev yazar. Kod yazmaz |
| developer | sonnet | `../collection-fishing-worktrees/<ad>` | Kod, `npm test`, commit, `agent/*` branch'ine push. Dosya düzenlemeleri sormadan (`acceptEdits`). Unity'yi açmaz |
| tester | haiku | ana repo (+ test klasörü) | Sadece `tools/agents/testbed.sh run …`. Kod düzeltmez |

Model ve klasör `.claude/agents/*.md` ve `tools/agents/agents.conf`'tan değişir. İkinci developer için `agents.conf`'a `dev2 developer wt:dev2 acceptEdits` satırı ekle. Pro planında limit çabuk dolar, bir developer genelde yeter.

İzinler:
- `.claude/settings.json` (repoda): sık kullanılan güvenli komutlara sormadan izin (git status / diff / log / add / commit, `agent/*` branch'ine push, `npm test`, `testbed.sh`).
- `~/.cg-agents/claude-settings.json` (sadece ajanlar): yasaklar. `main`'e push, force push, `gh pr merge`, `git reset --hard`, `rm -rf`, Unity'yi doğrudan çağırmak, `.env` okumak, `client/Library` ve `ProjectSettings` düzenlemek.
- Bunların dışındaki her şey sorar. Soru dashboard'da kırmızı kart olarak görünür, Onayla / Durdur ile cevaplarsın.

## Test klasörü

```bash
tools/agents/testbed.sh run <branch> [server|edit|play|all] [--filter TestAdı] [--wait]
tools/agents/testbed.sh status
```

- Branch'i test klasöründe `--detach` ile açar. İzlenen değişiklikleri atar, `client/Library` ve `server/node_modules` kalır.
- `all` (varsayılan): `npm test` + Unity EditMode. `npm ci` sadece `package-lock.json` değişince çalışır.
- Aynı anda tek test: kilit `~/.cg-agents/testbed.lock`. Meşgulse çıkış kodu 3, `--wait` ile sıraya girer.
- Çıkış kodu: 0 geçti, 1 kaldı, 2 hata (derleme hatası, Unity bulunamadı vb.).
- Unity yolu `client/ProjectSettings/ProjectVersion.txt`'ten bulunur, farklıysa `UNITY=/yol/Unity` ver.
- Unity'de henüz test assembly'si yok. İlk EditMode testleri eklenene kadar Unity adımı sadece "derleniyor mu" kontrolü olur (0 test).

## Dosyalar

| Dosya | Ne |
|---|---|
| `tools/agents/agents.conf` | Hangi ajanlar, hangi rol, hangi klasör |
| `tools/agents/agents.sh` | tmux: up / attach / status / stop / down |
| `tools/agents/worktree.sh` | Developer worktree'leri: new / path / list / rm |
| `tools/agents/testbed.sh` | Test klasörü: setup / run / status |
| `tools/agents/send.sh` | Terminalden prompt: `tools/agents/send.sh dev1 "007'yi yap"` |
| `tools/agents/hook.mjs`, `statusline.mjs` | Claude Code'dan JSON'a |
| `tools/agents/dashboard/` | `serve.mjs` (bağımlılıksız Node sunucusu) ve `index.html` |

`./cg agents phone`: telefon adresi ve QR kod.

Ortam değişkenleri: `CG_AGENTS_HOME` (varsayılan `~/.cg-agents`), `CG_WORKTREES`, `CG_TESTBED`, `CG_TMUX_SESSION` (varsayılan `cg`), `PORT` (7380).
