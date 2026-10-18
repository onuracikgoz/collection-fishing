# Item Art Studio
## Proje Özeti, Teknik Gereksinimler ve Geliştirme Talimatları

## 1. Projenin Amacı

Unity tabanlı, 2D pixel-art eşya toplama oyunu için geliştirilen yerel bir web aracıdır.

Oyunda kullanılacak eşya görselleri harici bir görsel üretim aracıyla, örneğin Perchance üzerinden oluşturulur. Bu uygulama, üretilen PNG görsellerini içe aktararak aynı temel tasarımdan farklı renk ve görsel varyantlar üretmeyi sağlar.

Örnek:

Bir adet siyah pixel-art güneş gözlüğü PNG'si yüklenir. Uygulama bu görseldeki renkleri analiz eder. Kullanıcı siyah plastik kısmı altın, mor veya kırmızı yapabilir. Cam rengini ayrıca değiştirebilir. Sonuç önizlenir ve Unity'de kullanılabilecek yeni bir PNG olarak dışa aktarılır.

Amaç, her varyantı yapay zekâyla yeniden üretmek yerine bir temel görselden kontrollü, hızlı ve tutarlı varyantlar oluşturmaktır.

**Önemli tasarım kararı:** Eşyalar karakter üzerinde giyilmiyor veya ekipman olarak takılmıyor. Bunlar koleksiyon ve envanter eşyaları. Bu nedenle her eşya için şimdilik tek, ortalanmış, önden görünüm PNG yeterlidir.

---

## 2. Kullanılacak Teknolojiler

- React
- TypeScript
- Vite
- HTML Canvas API
- CSS
- PNG dosya işleme
- JSON metadata dışa aktarımı için ileride genişletilebilir yapı

Uygulama yerel olarak tarayıcıda çalışır. Şimdilik backend, veritabanı, kullanıcı hesabı veya sunucu gerekmiyor.

Görsel düzenleme ve varyant üretimi mümkün olduğunca istemci tarafında yapılmalıdır.

---

## 3. Temel Kullanıcı Akışı

1. Kullanıcı bilgisayarından bir PNG dosyası yükler.
2. Uygulama görseli analiz eder ve Canvas üzerinde gösterir.
3. Görseldeki opak piksellerin renk paleti çıkarılır.
4. Kullanıcı paletten değiştirmek istediği rengi seçer.
5. Yeni bir renk seçer.
6. Seçilen eski renk grubu yeni renge dönüştürülür.
7. Kullanıcı birden fazla renk grubunu ayrı ayrı değiştirebilir.
8. Parlaklık ve doygunluk gibi genel görsel ayarlarını düzenleyebilir.
9. Tüm değişiklikleri önizler.
10. Sonucu yeni bir şeffaf PNG olarak dışa aktarır.
11. İleride varyant metadata'sı ve Unity uyumlu ZIP dışa aktarımı eklenebilir.

---

## 4. Görsel Gereksinimleri

Hedef görseller:

- PNG formatı
- Genellikle 128 × 128 piksel
- Şeffaf arka plan
- Tek eşya
- Ortalanmış kompozisyon
- Önden görünüm
- Keskin pixel-art kenarları
- Anti-aliasing olmadan veya minimum yumuşatma ile
- Karakter, el, yüz, metin, logo, UI veya birden fazla görünüm içermeyen tasarım

Uygulama görselin mevcut çözünürlüğünü korumalıdır. Kullanıcı ayrıca boyutlandırma özelliği talep etmedikçe görsel otomatik olarak 128 × 128 boyutuna zorlanmamalıdır.

Şeffaf pikseller hiçbir renk değiştirme işleminden etkilenmemelidir.

---

## 5. Mevcut Proje Yapısı

Proje kök dizini büyük olasılıkla `item-art-studio`.

Mevcut dosyalar:

```text
item-art-studio/
├── src/
│   ├── App.tsx
│   ├── App.css
│   └── engine/
│       ├── pngProcessor.ts
│       ├── colorMapping.ts
│       └── maskEditor.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Yeni agent önce gerçek proje dosyalarını incelemeli ve mevcut kodun durumunu doğrulamalıdır. Bu liste başlangıçtaki dosya yapısını temsil eder; dosyalarda sonradan değişiklik yapılmış olabilir.

Mevcut çalışan özellikleri incelemeden projeyi sıfırdan yazmamalıdır.

### `App.tsx`

Ana React arayüzü ve uygulama durumunu yönetir.

Şimdiye kadar kullanılan state'ler şunlardır:

```tsx
const [imageUrl, setImageUrl] = useState<string | null>(null)
const [imageName, setImageName] = useState('')
const [imageSize, setImageSize] = useState('')
const [brightness, setBrightness] = useState(100)
const [saturation, setSaturation] = useState(100)
const [analysis, setAnalysis] = useState<PngAnalysis | null>(null)
const [selectedColor, setSelectedColor] = useState<string | null>(null)
const [replacementColor, setReplacementColor] = useState('#40A0FF')
const [replaceMode, setReplaceMode] = useState(false)
const [colorTolerance, setColorTolerance] = useState(32)
const [colorReplacements, setColorReplacements] = useState<Record<string, string>>({})
const [regions, setRegions] = useState<ReturnType<typeof createRegionMask>['regions']>([])
```

Agent, kullanılmayan state'leri ve import'ları gerçek kodu inceledikten sonra temizleyebilir.

### `colorMapping.ts`

Renk gruplama ve palet çıkarma işlevlerini içerir.

Mevcut kod:

```ts
export interface PaletteColor {
  hex: string
  count: number
}

export function getColorGroupKey(
  r: number,
  g: number,
  b: number,
  tolerance = 32,
): string {
  const step = Math.max(1, Math.min(64, tolerance))

  return [
    Math.floor(r / step),
    Math.floor(g / step),
    Math.floor(b / step),
  ].join('-')
}

export function hexToColorGroupKey(
  hex: string,
  tolerance = 32,
): string {
  const values = hex.match(/[0-9A-F]{2}/gi)

  if (!values || values.length !== 3) {
    return ''
  }

  return getColorGroupKey(
    parseInt(values[0], 16),
    parseInt(values[1], 16),
    parseInt(values[2], 16),
    tolerance,
  )
}

export function extractColorPalette(
  data: Uint8ClampedArray,
): PaletteColor[] {
  const groups = new Map<
    string,
    { r: number; g: number; b: number; count: number }
  >()

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]

    if (alpha === 0) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = getColorGroupKey(r, g, b)

    const group = groups.get(key)

    if (group) {
      group.r += r
      group.g += g
      group.b += b
      group.count++
    } else {
      groups.set(key, { r, g, b, count: 1 })
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const r = Math.round(group.r / group.count)
      const g = Math.round(group.g / group.count)
      const b = Math.round(group.b / group.count)

      const hex =
        '#' +
        [r, g, b]
          .map((value) => value.toString(16).padStart(2, '0'))
          .join('')

      return {
        hex: hex.toUpperCase(),
        count: group.count,
      }
    })
    .sort((a, b) => b.count - a.count)
}
```

Bu sistem RGB kanallarını belirli aralıklara bölerek benzer renkleri aynı grupta toplar. `tolerance` değeri gruplamanın hassasiyetini belirler.

Ancak mevcut uygulamada renk paleti çıkarma işlemi `32` varsayılan toleransıyla çalışıyor. Kullanıcının tolerans değerini değiştirmesiyle paletin yeniden hesaplanması henüz doğru şekilde bağlanmamış olabilir. Bu durum kontrol edilmelidir.

---

## 6. En Önemli Özellik: Renk Paleti ve Renk Değiştirme

Bu bölüm önceliklidir. Mevcut uygulamadaki renk değiştirme sistemi tutarlı ve hatasız hâle getirilmelidir.

### Beklenen arayüz

Renk paletindeki her renk ayrı bir seçenek olarak gösterilir. Her seçenek için:

- Renk örneği
- Renk HEX kodu
- İsteğe bağlı piksel sayısı

gösterilebilir.

Kullanıcı bir palet rengine tıkladığında o renk seçilir. Seçilen rengi değiştirmek için bir renk seçici bulunur.

Mevcut renk seçici:

```tsx
<label>
  Replacement color
  <input
    type="color"
    value={replacementColor}
    onChange={(event) =>
      setReplacementColor(event.target.value.toUpperCase())
    }
  />
</label>
```

### İstenen yeni davranış

Palet seçenekleri için ayrı ayrı `Select`, `Apply` veya `Replace` butonlarına ihtiyaç kalmamalıdır.

İstenen iş akışı:

1. Kullanıcı bir palet rengine tıklar.
2. Yeni rengi seçer.
3. Seçilen palet rengi otomatik olarak yeni renge dönüştürülür.
4. Kullanıcı başka bir palet rengi seçip aynı işlemi tekrarlayabilir.
5. Önceden yapılan renk değişiklikleri korunur.

Alternatif olarak palet seçeneğine tıklandığında o an seçili olan yeni renk doğrudan uygulanabilir. Fakat kullanıcı arayüzü net olmalı ve bir rengi seçmekle uygulamak arasındaki davranış kafa karıştırmamalıdır.

**Önerilen yaklaşım:** Bir palet rengine tıklamak o rengi seçsin. Renk seçici değiştirildiğinde seçili gruba dönüşüm uygulansın. Böylece kullanıcı her seferinde yeni rengi seçip ayrıca Apply düğmesine basmak zorunda kalmasın.

Her renk grubunun dönüşümü `colorReplacements` içinde saklanabilir:

```ts
Record<string, string>
```

Burada anahtar kaynak renk grubunu, değer hedef HEX rengini temsil eder.

### Kritik doğruluk gereksinimi

Renk grupları her zaman **orijinal görselin piksel renklerinden** hesaplanmalıdır.

Önizleme üzerinde zaten dönüştürülmüş pikselleri tekrar analiz ederek sonraki renk gruplarını bulmak hatalı sonuçlara neden olabilir. Örneğin siyahı kırmızıya dönüştürmek, kırmızı kaynak grubunun da yanlışlıkla değişmesine neden olabilir.

Doğru yaklaşım:

- Orijinal görselin piksel verisini koru.
- Her render işleminde orijinal verinin bir kopyasını al.
- Bütün renk dönüşümlerini orijinal pikseller üzerinden uygula.
- Sonuçta Canvas'a tek seferde yaz.
- Renk dönüşümlerini birbirinden bağımsız tut.

Renk grubu anahtarları tutarlı biçimde aynı `colorTolerance` değeriyle hesaplanmalıdır.

---

## 7. Önizleme ve Canvas İşleme

Görsel Canvas üzerinde gösterilir.

Mevcut uygulamada bir `useEffect`, görseli yeniden yükleyerek Canvas'a çiziyor. Ardından pikseller üzerinde renk değişiklikleri ve seçili renk vurgusu uygulanıyor.

Agent şu gereksinimleri sağlamalıdır:

- Orijinal görselin kaynak verisi kaybolmamalı.
- Şeffaf pikseller korunmalı.
- Renk değişiklikleri birbirini bozmamalı.
- Palet seçimi ve renk seçici değişikliği önizlemeyi güncellemeli.
- Parlaklık ve doygunluk değişiklikleri önizlemede görünmeli.
- Renk seçimi değişiklikleri dışa aktarılan dosyayı etkilemeli.
- Canvas boyutları kaynak görselin doğal boyutlarını korumalı.
- Ekranda ölçeklenen Canvas üzerindeki tıklama koordinatları gerçek piksel koordinatlarına doğru çevrilmeli.

Seçili renk grubu için geçici pembe/mor vurgulama uygulanıyorsa bu vurgu yalnızca önizleme amacıyla kullanılmalı ve dışa aktarılan PNG'ye yazılmamalıdır.

---

## 8. Reset All Butonu

Arayüze `Reset All` butonu eklenmelidir.

Bu buton, kullanıcı onayından bağımsız olarak, tüm düzenleme işlemlerini başlangıç durumuna döndürmelidir.

Sıfırlanacaklar:

- Tüm renk dönüşümleri
- Seçili palet rengi
- Seçili renk değiştirme modu
- Parlaklık: `100`
- Doygunluk: `100`
- Renk toleransı: `32`
- Yeni renk seçici: `#40A0FF`

Görselin kendisi silinmemelidir. Kullanıcı yeniden dosya yüklemek zorunda kalmadan orijinal görsele dönmelidir.

Reset işlemi sonrası Canvas, orijinal PNG'nin görünümünü göstermelidir.

---

## 9. Parlaklık ve Doygunluk

Mevcut state'ler:

```ts
const [brightness, setBrightness] = useState(100)
const [saturation, setSaturation] = useState(100)
```

Değerler yüzde olarak kullanılır.

- `100`: Orijinal değer
- `100` üstü parlaklık: Daha aydınlık
- `100` altı parlaklık: Daha karanlık
- `100` üstü doygunluk: Daha canlı renkler
- `100` altı doygunluk: Daha soluk renkler

Bu ayarlar hem önizlemede hem dışa aktarılan PNG'de aynı sonucu üretmelidir.

Şeffaflık korunmalıdır.

---

## 10. PNG Dışa Aktarma

Mevcut `exportPng()` fonksiyonu bulunuyor. Agent önce bunu incelemeli.

Beklenen davranış:

1. Orijinal görseli yükle.
2. Orijinal piksel verisini Canvas'a çiz.
3. Kaydedilmiş tüm `colorReplacements` dönüşümlerini uygula.
4. Parlaklık ve doygunluk ayarlarını uygula.
5. Sonucu PNG olarak dışa aktar.
6. Şeffaflığı ve orijinal çözünürlüğü koru.

Dosya adı örneği:

```text
sunglasses-gold-edited.png
```

Dosya adının oluşturulması güvenli olmalı; `.png` uzantısı iki kez eklenmemeli.

Mevcut export kodu seçili renk için tek bir dönüşüm uyguluyor olabilir. Bu yeterli değildir. Kullanıcı birden fazla renk grubunu değiştirdiyse **bütün kayıtlı dönüşümler** dışa aktarılan PNG'ye uygulanmalıdır.

Önizleme ile dışa aktarılan görsel mümkün olduğunca aynı olmalıdır.

---

## 11. İleride Eklenebilecek Özellikler

Bunlar ilk aşamada zorunlu değildir. Öncelik mevcut renk düzenleme sistemini doğru çalıştırmaktır.

### A. Varyant üretimi

Bir temel tasarımdan farklı sürümler oluşturulabilir:

- Plastik
- Krom
- Altın
- Karbon fiber
- Siyah, mor, kırmızı ve benzeri renkler
- Geometrik desenler
- Leopar desenleri
- Devre deseni

Her varyant kullanıcı tarafından incelenmeli ve onaylanmalıdır. Tüm kombinasyonları otomatik üretmek hedeflenmiyor.

### B. Malzeme efektleri

İleride renk değişikliğinin ötesinde:

- Parlaklık
- Metalik görünüm
- Yansıma
- Mat yüzey
- Aşınma
- Kirlenme
- Solma

gibi efektler eklenebilir.

Ancak bu efektler pixel-art stilini bozmamalıdır. Basit bir renk değiştiriciyi karmaşık bir 3D materyal editörüne dönüştürmek gereksizdir.

### C. Float ve eşya kondisyonu

Oyunda eşya kazanıldığı anda rastgele bir `float` veya kondisyon değeri atanacaktır.

Bu değer bu araçta belirlenmemelidir.

Unity tarafı daha sonra float değerine göre görselin parlaklığını, aşınmasını, kirini veya solmuş görünümünü değiştirebilir. Generator temel tasarım ve varyant üretimi içindir; oyun içi rastgele kondisyon sistemi değildir.

### D. Metadata ve Unity export

İleride PNG yanında JSON metadata üretilebilir.

Örnek:

```json
{
  "base_design_id": "sunglasses_001",
  "variant_id": "sunglasses_gold_001",
  "display_name": "Gold Sunglasses",
  "image": "sunglasses-gold-001.png",
  "resolution": {
    "width": 128,
    "height": 128
  }
}
```

Bu örnek bir taslaktır. Gerçek şema, Unity projesinin ihtiyaçlarına göre kararlaştırılmalıdır.

İleride birden fazla onaylanmış varyantı ZIP olarak dışa aktarma özelliği eklenebilir.

---

## 12. Kod Kalitesi ve Mimari Beklentiler

Agent şu kurallara uymalıdır:

- Mevcut dosyaları incelemeden yeniden yazma.
- Çalışan özellikleri gereksiz yere bozma.
- React state'ini tek bir tutarlı kaynak olarak kullan.
- Görsel işleme kodunu mümkün olduğunca `engine/` altında tut.
- UI kodu ile piksel işleme algoritmalarını birbirine karıştırma.
- TypeScript türlerini koru.
- Gereksiz kütüphane ekleme.
- Tarayıcı Canvas API'sini kullan.
- Şeffaflık ve pixel-art görüntü kalitesini koru.
- `any` kullanımını gereksiz yere artırma.
- Aynı işlevi farklı yerlerde tekrarlayan kodları gerektiğinde ortaklaştır.
- Hataları sessizce yutma; kullanıcıya anlaşılır mesajlar göster.
- Büyük refactor yapmadan önce mevcut davranışı ve olası regresyonları kontrol et.

---

## 13. Uygulama Sırası

Agent şu sırayla çalışmalıdır:

### Aşama 1: Mevcut kodu denetle

- `App.tsx` dosyasını incele.
- `pngProcessor.ts`, `colorMapping.ts` ve `maskEditor.ts` dosyalarını incele.
- Mevcut UI, Canvas çizimi, renk paleti ve export akışını tespit et.
- Derleme veya TypeScript hatalarını belirle.
- Henüz kodu yeniden yazma.

### Aşama 2: Renk düzenleme sistemini düzelt

- Palet renklerini doğru üret.
- Renk toleransını tutarlı uygula.
- Palet renginin seçilmesini sağla.
- Seçili rengin doğrudan uygulanmasını sağla.
- Birden fazla dönüşümün birlikte çalışmasını sağla.
- Orijinal görsel verisini koru.
- Önizleme ve export sonuçlarını eşleştir.

### Aşama 3: Reset All

- Tüm dönüşümleri temizle.
- Tüm ayarları varsayılana döndür.
- Orijinal PNG önizlemesini geri getir.

### Aşama 4: Test et

En az şu senaryoları test et:

1. PNG yükleme.
2. Paletten renk seçme.
3. Renk değiştirme.
4. Aynı görselde iki farklı rengi değiştirme.
5. Bir dönüşümün diğer dönüşümü bozmaması.
6. Şeffaf piksellerin korunması.
7. Parlaklık ve doygunluk değişiklikleri.
8. PNG dışa aktarma.
9. Dışa aktarılan PNG'nin önizlemeyle eşleşmesi.
10. Reset All sonrası orijinal görselin geri gelmesi.
11. Farklı tolerans değerleri.
12. Bozuk veya desteklenmeyen dosya yükleme.

### Aşama 5: Raporla

İş sonunda agent şunları açıklamalıdır:

- Hangi dosyalar değiştirildi?
- Hangi sorunlar çözüldü?
- Hangi özellikler çalışır durumda?
- Hangi özellikler eksik?
- Build veya TypeScript kontrolü başarılı mı?
- Bilinen sorunlar var mı?

---

## 14. İlk Görev

İlk görev yeni özellik eklemek değil, mevcut uygulamayı denetlemek ve renk düzenleme sistemini tamamlamaktır.

**Öncelik sırası:**

1. Doğru renk gruplama.
2. Tek tıklamayla renk seçimi ve uygulama akışı.
3. Birden fazla renk dönüşümünü koruma.
4. `Reset All`.
5. PNG export doğruluğu.
6. Önizleme ve export tutarlılığı.

Bu özellikler düzgün çalışmadan malzeme efektleri, otomatik varyant kombinasyonları veya metadata sistemine geçme.