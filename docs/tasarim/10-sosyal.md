# Sosyal Sistemler

> Kaynak: tasarım dokümanı v0.8, bölüm 13. Numaralar eski dokümana atıf için korunmuştur.

## 13. Sosyal Sistemler

### 13.1. Chat

- Mesajlar karakterin üstünde **chat balonu** olarak görünür, yalnızca yakındakilere. Yanında bir chat geçmişi paneli bulunur.
- Arkadaşlarla **özel mesaj**. "Sadece arkadaşlardan mesaj al" ayarı, engelleme ve raporlama her durumda vardır.
- Chat açıkken klavye girdisi balık tutma kontrolleriyle çakışmaz (örneğin chat açıkken SPACE yazıya gider).
- **Moderasyon baştan gerekli:** küfür filtresi, raporlama, susturma.

### 13.1.1. Yaş Hedefi: Genel Kitle

- Oyun **genel kitleye** (13+) yöneliktir.
- Bu yüzden **flört özellikleri yoktur** (öpücük emote'u, "çift" rozeti, romantik mekanlar vb.). Arkadaşça emote'lar (el sallama, alkış, dans) vardır.
- **Yabancılardan özel mesaj varsayılan olarak kapalıdır**, yalnızca arkadaşlar yazabilir.
- Sıkı moderasyon: küfür ve kişisel bilgi (telefon, adres, sosyal medya) filtresi, raporlama, engelleme, susturma.
- KVKK ve COPPA gereklilikleri yayından önce kontrol edilmeli (13 yaş altı için ebeveyn izni).
- **Dikkat:** genç kitle ile dış sitelerde gerçek para satışı birleşince dolandırıcılık ve reşit olmayanların para harcaması riski artar. Bölüm 12.2'deki hukuki görüşte bu da sorulmalı.

### 13.1.2. Whisper (Knight Online Tarzı)

- Her özel konuşma ekranda **ayrı küçük bir pencere** olarak açılır; birden fazla pencere açık kalabilir, küçültülebilir, yeni mesajda yanıp söner.
- Chat'e **`/w Nick mesaj`** yazarak veya panodaki ilana / oyuncuya tıklayıp "Whisper at" ile gönderilir.
- Her oyuncunun **"PM kapalı"** düğmesi vardır.
- **Genel kitle ile uyum:** arkadaşlar her zaman yazabilir. Yabancıya whisper yalnızca **pazar bağlamında** (satış / alım ilanından "Whisper at") ve gönderen en az level 10 ise açılır. Kişisel bilgi filtresi whisper'da da çalışır; engelle / raporla tek tıklıktır.

### 13.2. Oyuncu Etkileşimi

Bir oyuncuya tıklanınca: profil kartı, Collection Book'u incele, arkadaş ekle, whisper, takas teklif et. Envanter ve recipe'ler hiçbir zaman gösterilmez.

### 13.2.1. Arkadaşlar

- Arkadaşlık isteği gönderilir, karşı taraf onaylar.
- Listede kim çevrimiçi, hangi sunucuda, haritanın neresinde görünür; **"Yanına git"** butonu vardır.

### 13.2.2. Emote'lar

- Arkadaşça, genel kitleye uygun: el sallama, alkış, dans, oturma, gülme, **balık gösterme** (son avı havaya kaldırma).
- **Durum emote'u (karar 29.10.2026):** emote artık sadece anlık bir hareket değil. Oyuncu bir **durum emote'u** seçer; karakterinin üstünde **kalıcı** bir balon olarak durur (yürürken, balık tutarken, hatta oyundan çıkana kadar), sunucudaki herkes görür. Aynı anda **bir** tane takılır; "Kaldır" ile veya başkasını seçerek değişir. Örnek: uyuyor (zzz), balık, soru, müzik, kahve.
- **Hareketler** (el sallama, alkış, dans) kısa süren animasyondur, bitince kaybolur.
- **Kimler alabilir:**
  - **Herkese açık:** ücretsiz, temel set.
  - **Destekçi:** destekçi paketiyle gelen emote'lar (altın çerçeve, taç işareti).
  - **Elmasla alınır:** tek tek satın alınır, **takas edilmez** (kural 2).
  - **Defter ödülü:** set tamamlayınca açılır (`06-defter.md` prestij ödülleri).
- Emote'lar yalnızca görünümdür, drop ya da Float'ı etkilemez. Flört içeriği yok (kalp vb.): genel kitle 13+.
- Sunucu emote kimliğini ve sahipliğini doğrular; sohbet filtresi gerekmez (metin yok). Protokol: `docs/protokol.md` Emote bölümüne durum emote'u eklenecek (sözleşme önce).

### 13.3. Profil Kartı ve Showcase

- İsim, level, Collection Score, unvan.
- **3 showcase eşyası** (Tier, Float ve kondisyon görünümüyle, parıltısıyla).
- Tamamlanan setler, First Discovery'ler, "🎯 Arıyorum" etiketi.
- Profil kartından oyuncunun Collection Book'u açılır.

### 13.3.1. Kulüpler (Sonraki Fazlar)

Arkadaş grupları isimli bir kulüp kurup ortak chat kanalı kullanabilir. Niş toplulukların oluşmasına yardım eder.

### 13.4. Currently Hunting

Oyuncu defterden bir eşya seçip `🎯 Arıyorum: Ancient Ruby` olarak işaretleyebilir. Diğerleri bunu görür. Sohbeti, takası ve yardımlaşmayı teşvik eder.
