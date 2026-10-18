Game Design & Systems Specification — v0.2
1. Oyunun Temel Tanımı
Oyun; online sosyal farm + collection + crafting + player-driven economy + sohbet üzerine kurulu.

Oyuncu:

Bir farm alanına girer.

Alanın ana objesi üzerinde farm yapar.

XP ve item kazanır.

Itemları koleksiyonuna ekler.

Eksik collection parçalarını bulmaya çalışır.

Bazı itemları craft eder.

Recipe keşfeder veya satın alır.

Itemları Steam Market üzerinden satabilir veya satın alabilir.

Diğer oyuncuların koleksiyonlarını inceleyebilir.

Collection Score / ekonomik değeri üzerinden sosyal statü kazanır.

Auto-Farm ve boosterlarla farm sürecini optimize eder.

Sezonlar ve sınırlı üretimler sayesinde koleksiyonunu uzun vadede geliştirir.

Temel oyuncu döngüsü:

FARM → ITEM → COLLECTION → CRAFT / MARKET → DAHA İYİ COLLECTION → SOSYAL STATÜ → FARM

2. Oyunun Ana Felsefesi
Oyunun ana amacı yalnızca farm yapmak değildir.

Farm, oyuncunun:

collection geliştirmesini,

nadir item bulmasını,

recipe keşfetmesini,

markette ekonomik karar vermesini,

diğer oyuncularla etkileşime girmesini

sağlayan araçtır.

Temel oyuncu motivasyonu:

"Koleksiyonumu diğer oyunculardan daha değerli / daha tamamlanmış / daha prestijli hale getirmek."

3. Online Farm Alanları
Oyun online çalışır.

Oyuncular belirli farm bölgelerine girer.

Örnek:

Mine

Cave

Valley

Crystal Cave

Konsept isimleri daha sonra belirlenecek.

3.1. Alan Kapasitesi
Her farm instance'ı maksimum 10 oyuncu içerir.

Örnek:

Crystal Cave #14 — 7 / 10 Players

Oyuncular aynı farm objesinin çevresinde bulunabilir.

Amaç:

farm yapmak,

diğer oyuncuları görmek,

sohbet etmek,

koleksiyonlarına bakmak,

sosyal etkileşim oluşturmak.

4. Bölge / Zone Progression
Farm bölgeleri progression ile açılır.

Oyuncu başlangıçta bütün alanlara erişemez.

Örnek:

Zone 1 → başlangıç

Zone 2 → Level 5

Zone 3 → Level 10

Zone 4 → Level 20

Kesin level değerleri daha sonra belirlenecek.

Her bölgenin kendine ait:

item pool'u,

Tier dağılımı,

drop rate'leri,

recipe pool'u,

materyalleri,

özel itemları

olabilir.

Yeni bölge yalnızca daha yüksek level anlamına gelmemeli; farklı bir ekonomik ve collection havuzu sunmalıdır.

5. Farm Mekaniği
Her farm alanında temel bir farm objesi bulunur.

Örneğin:

Rock

Ore

Tree

Crystal

Oyuncu:

mouse click,

keyboard input

ile farm yapabilir.

Her valid farm action:

XP üretir,

item drop roll'unu çalıştırır,

uygunsa item üretir.

6. Farm Action
Her farm aksiyonu server tarafından doğrulanır.

Client'ın:

"Ben 100 kez tıkladım."

demesi tek başına ödül üretmemelidir.

Server:

action timing,

oyuncu state'i,

zone,

cooldown,

farm state,

room state

üzerinden valid action belirler.

Amaç:

macro abuse,

bot abuse,

sahte reward,

client manipülasyonu

engellemektir.

7. XP
Her valid farm action XP verebilir.

XP:

oyuncunun level'ını artırır,

yeni bölgelerin açılmasını sağlar.

XP'nin item market değeriyle doğrudan bağlantısı yoktur.

8. Item Sistemi
Oyunda çok yüksek sayıda item bulunabilir.

Itemlar farklı kaynaklardan elde edilebilir:

Farm drop

Craft

Season

Special Event

Recipe Craft

Steam Market üzerinden satın alma

Itemların temel amacı:

Collection'a eklenmek

Crafting'de kullanılmak

Player-driven economy içinde işlem görmek

Her item bir item instance olarak değerlendirilir.

9. Item Tier & Float Sistemi
Item sistemi iki ayrı temel değerden oluşur:

Tier

Float

Bu iki değer birbirinden bağımsızdır.

9.1. Item Tier
Itemın temel kategori / nadirlik sınıfıdır.

Tier sistemi:

Common

Rare

Epic

Legendary

Mythic

Tier, itemın temel kimliğinin parçasıdır.

Örneğin:

Legendary Red Crystal

aynı itemın farklı Float değerlerine sahip instance'larına sahip olabilir.

Tier ile Float birbirinden bağımsızdır.

Örneğin:

Bir Common item çok iyi bir Float değerine sahip olabilir.

Ancak bu item:

Rare / Epic / Legendary / Mythic

olmaz.

9.2. Float
Her item instance'ının:

0.0000 – 1.0000

arasında bir Float değeri bulunur.

Float:

itemın görsel kalitesini,

parlaklığını,

kondisyonunu,

koleksiyon prestijini,

potansiyel ekonomik değerini

etkileyebilir.

0'a yaklaştıkça item daha kaliteli / özel kabul edilir.

Örnek:

Legendary Red Crystal
Float: 0.01372

ve:

Legendary Red Crystal
Float: 0.48192

aynı itemdır ancak ilk instance daha değerli olabilir.

Float doğrudan market fiyatı değildir.

9.3. Drop Rate / Tier / Float Ayrımı
Bu üç sistem birbirinden bağımsızdır.

Drop Rate
Itemın elde edilme ihtimalidir.

Tier
Itemın temel sınıfıdır.

Float
Belirli item instance'ının kondisyon / kalite değeridir.

Örneğin:

Mythic Void Crown

Drop Rate: %0.01

Tier: Mythic

Float: 0.01372

veya:

Common Red Stone

Drop Rate: %10

Tier: Common

Float: 0.00421

olabilir.

Çok zor çıkan item otomatik olarak en yüksek Tier olmak zorunda değildir.

Aynı şekilde düşük Tier bir item çok iyi Float değerine sahip olabilir.

10. Float ve Market Value
Market fiyatı yalnızca Float'a göre belirlenmez.

Fiyatı etkileyebilecek faktörler:

Item Tier

Float

Total Supply

Season

Collection importance

Demand

Acquisition difficulty

Crafting difficulty

Item history

Market liquidity

Örneğin:

Çok iyi Float'a sahip bir Common item yüksek supply nedeniyle ucuz olabilir.

Buna karşılık daha kötü Float'a sahip çok sınırlı bir Mythic item daha pahalı olabilir.

Dolayısıyla:

Float = kalite / değer potansiyeli

ancak:

Float ≠ doğrudan fiyat

olarak ele alınır.

11. Float'ın Görsel Etkisi
Float yalnızca sayısal bir değer olmamalıdır.

Float değerinin itemın görünümüne yansıması tercih edilir.

Örnek:

Float	Görsel Sınıf
0.00 – 0.05	Pristine
0.05 – 0.20	Excellent
0.20 – 0.50	Normal
0.50 – 0.80	Worn
0.80 – 1.00	Damaged

Bu isimlendirmeler henüz kesin değildir.

Asıl amaç:

Oyuncunun 0.01 Float ile 0.70 Float arasındaki farkı itemın görünüşünden anlayabilmesidir.

12. Item-Specific Float Range
Her itemın Float aralığı aynı olmak zorunda değildir.

Örneğin:

Legendary Red Cave
Min Float: 0.00

Max Float: 0.80

Mythic Void Crown
Min Float: 0.00

Max Float: 0.15

Bu durumda:

0.10 Float

bir item için çok iyi olabilirken başka bir item için normal kabul edilebilir.

Float değerlendirmesi item-specific olabilir.

13. Item Pool
Her zone'un kendi item pool'u bulunur.

Örneğin:

Red Cave
Common Materials

Rare Materials

Craft Materials

Recipes

Special Items

Her itemın:

Drop Rate

Tier

Float Range

Acquisition Source

değerleri ayrı tanımlanabilir.

14. Item Instance Yapısı
Hedeflenen item yapısı:

ITEM INSTANCE
│
├── Item ID / Item Definition
├── Tier
│   ├── Common
│   ├── Rare
│   ├── Epic
│   ├── Legendary
│   └── Mythic
│
├── Float
│   └── 0.0000 – 1.0000
│
├── Season
├── Instance ID
├── Acquisition Source
└── Market State

Float, Tier ve Supply birbirinden bağımsız değerlerdir.

Item instance benzersizliği özellikle yüksek Float hassasiyeti gereken itemlarda önemlidir.

15. Seed / RNG / Generator Sistemi
Item üretimi backend tarafından RNG / generator sistemiyle belirlenebilir.

Seed:

drop roll,

item selection,

Tier selection,

Float generation

gibi işlemlerde teknik veri olarak kullanılabilir.

Seed doğrudan oyuncuya gösterilmek zorunda değildir.

Örnek:

Farm Action
    ↓
Server Validation
    ↓
RNG / Generator
    ↓
Item Pool
    ↓
Item Selection
    ↓
Tier
    ↓
Float
    ↓
Item Instance

Seed oyuncunun ekonomik item kimliği değildir.

16. Collection Sistemi
Oyundaki collection parçaları oyuncunun Collection ekranında bulunur.

Collection:

itemların tamamını,

sahip olunan itemları,

eksik itemları

gösterir.

Örnek:

RED CAVE COLLECTION

8 / 15

Red Stone       ✓
Red Crystal     ✓
Ancient Ruby    ?
???             ?
???             ?

Oyuncunun amacı collection setlerini mümkün olduğunca tamamlamaktır.

17. Collection Public'tir
Oyuncular başka oyuncuların collection'larını görebilir.

Inventory public değildir.

Public
Collection

Collection Score

Showcase

Favorite Items

Bazı profil istatistikleri

Private
Inventory

Recipe Knowledge

Kullanılabilir itemların tamamı

Ekonomik stratejiler

18. Undiscovered Item Gizliliği
Oyuncu henüz bir itemı keşfetmediyse itemın adı public collection'da açıkça gösterilmek zorunda değildir.

Örneğin:

Red Cave

8 / 15

Red Stone
Red Crystal
???
???
Ancient Ruby
???

Ancak başka bir oyuncunun collection'ında item varsa itemın gerçek adı görülebilir.

Amaç:

"Bu itemın oyunda olduğunu biliyorum."

ile:

"Bu item nasıl elde ediliyor?"

arasında fark oluşturmaktır.

19. Collection Completion
Collection setlerinin tamamlanması prestige ödülleri sağlayabilir.

Örneğin:

Collection Achievement

Title

Badge

Cosmetic

Profile Reward

Profile Frame

Emote

Character Effect

Bu ödüllerin ekonomik item üretmemesi tercih edilir.

20. Collection Score
Oyuncunun market dolar değerinden bağımsız sosyal bir değeri bulunur.

Örnek:

Collection Score: 32,231

Collection Score hesaplamasında ileride:

Collection Completion

Tier

Float quality

Unique Items

Seasonal Items

First Discoveries

Collection difficulty

gibi parametreler kullanılabilir.

Kesin formül ekonomi ve playtest sonrasında belirlenecektir.

21. Estimated Market Value
Collection Score'dan ayrı olarak:

Estimated Market Value: $3,223

gibi ekonomik bir gösterge bulunabilir.

Bu değer:

gerçek piyasa değeri değil,

anlık / tahmini bir ekonomik gösterge

olarak ele alınmalıdır.

Karakter üzerinde dolar göstermek yerine:

PlayerName

32,231

şeklinde Collection Score göstermek tercih edilir.

22. Item Showcase
Oyuncu belirli itemlarını profilinde showcase edebilir.

Örnek:

PLAYER

Collection Score: 32,231

SHOWCASE

[Void Crown]
[Ancient Ruby]
[Golden Skull]

Showcase edilen itemların:

Tier

Float

görsel kondisyonu

gibi bilgileri gösterilebilir.

23. Favorite Items
Oyuncu belirli sayıda itemı Favorite olarak işaretleyebilir.

Favorite itemlar:

Profil

Showcase

Sosyal alan

üzerinden gösterilebilir.

Amaç oyuncuya:

"Benim en değerli / en sevdiğim itemlar bunlar."

diyebilme imkanı vermektir.

24. Recipe Sistemi — Güncel Kural
Recipe:

Hesaba bağlı crafting yetkisi

olarak çalışır.

Recipe'yi bilmeyen oyuncu itemın tarifini internette bulsa bile itemı craft edemez.

Örneğin:

3 × Red Crystal
2 × Ancient Dust
1 × Blood Core

kombinasyonunu bilmek crafting yetkisi sağlamaz.

Ana kural:

Recipe yoksa craft yok.

25. Recipe Acquisition
Recipe'ler:

Farm Drop

Special Drop

Season

Event

Steam Market

yollarıyla elde edilebilir.

Recipe drop rate'i normal itemlardan çok daha düşük olabilir.

Recipe'nin ekonomik değeri:

"Bu itemı craft edebilme hakkı"

olmasından gelir.

26. Experiment Crafting
Rastgele kombinasyonları deneyerek recipe keşfetme sistemi kaldırılmıştır.

Ana kural:

Recipe yoksa craft yok.

Sebepler:

Wiki / internet üzerinden bypass edilmesini engellemek

Recipe ekonomisini korumak

Discovery'yi oyun içinde tutmak

Brute-force crafting'i önlemek

Büyük item havuzunda gereksiz kombinasyon denemelerini engellemek

Recipe discovery oyun içinde gerçekleşmelidir.

27. Recipe Learn / Sell
Oyuncu tradeable bir recipe elde ettiğinde iki seçeneğe sahiptir.

Learn
Recipe hesaba bağlanır.

Oyuncu artık o recipe ile craft yapabilir.

Recipe:

Non-tradable

hale gelir.

Sell
Oyuncu recipe'yi başka oyuncuya satabilir.

Recipe öğrenilmediği sürece ekonomik asset olarak kalır.

Temel kural:

Learn → Crafting Access

Learn → No Longer Tradable

Sell → Crafting Access Yok

28. Recipe Knowledge Privacy
Oyuncunun bildiği recipe'ler public değildir.

Başka oyuncular:

"Bu oyuncu hangi recipe'leri biliyor?"

bilgisini göremez.

Collection public kalırken Recipe Knowledge private tutulur.

Recipe bilgisi oyuncuya ekonomik avantaj sağlayan özel bilgi olarak kalır.

29. Recipe Discovery
Recipe'nin ilk kez elde edilmesi:

FIRST DISCOVERY

olarak kaydedilebilir.

Örneğin:

PlayerX discovered a new recipe.

Global bildirim isteğe bağlıdır.

Recipe'nin içeriği diğer oyunculara otomatik olarak açıklanmaz.

30. First Discovery
Bazı recipe / itemlar ilk kez keşfedildiğinde:

First Discovery

statüsü kazanabilir.

Örneğin:

Ancient Ruby

First discovered by:
PlayerX

Bu bilgi oyuncunun profilinde tutulabilir.

31. Discovery Leaderboard
İleride:

FIRST DISCOVERIES

#1 PlayerA — 42
#2 PlayerB — 31
#3 PlayerC — 28

gibi leaderboard oluşturulabilir.

Leaderboard:

Toplam recipe sayısından ziyade ilk keşfedilen recipe / item sayısını ölçmelidir.

32. Craft Sistemi
Temel yapı:

RECIPE
+
REQUIRED MATERIALS
+
CRAFT COST
=
ITEM INSTANCE

Örneğin:

Legendary Red Cave Recipe

3 × Red Crystal
2 × Ancient Dust
1 × Blood Core

↓

Legendary Red Cave

Craft edilen materyaller inventory'den tüketilir.

33. Craft & Float
Craft sonucu ortaya çıkan itemın Float değeri yeniden belirlenir.

Craft edilen itemın Float'ı input itemların basit ortalaması olmamalıdır.

Örneğin:

Legendary Crystal
0.08

Legendary Crystal
0.14

Legendary Crystal
0.21

input olarak kullanıldığında:

0.1433

Float değerinin garanti edilmesi istenmez.

Bunun yerine inputların kalitesi output'un olasılık dağılımını etkileyebilir.

İyi Float'lı inputlar:

daha iyi Float elde etme ihtimalini artırabilir,

ancak sonucu garanti etmez.

34. Craft Economic Principle
Craft sistemi oyuncuya garantili ekonomik kâr sağlamamalıdır.

Örneğin:

3 Input Item
Toplam Market Value: $30

Craft sonucunun uzun vadeli beklenen market değeri:

$30'dan düşük veya en fazla ona yakın

olmalıdır.

Ancak düşük ihtimalli yüksek değerli sonuçlar bulunabilir.

Böylece craft:

Risk / Reward + Item Sink

mekaniği haline gelir.

Oyuncu:

itemı satabilir,

itemı craftlayabilir,

daha iyi Float elde etmeyi deneyebilir.

Craft'ın amacı garantili para kazanmak değil:

duplicate itemları değerlendirmek,

item sink oluşturmak,

yüksek kaliteli instance kovalamak

olmalıdır.

35. Duplicate Item ve Craft
Collection'a zaten sahip olunan bir item tekrar elde edildiğinde oyuncunun üç temel seçeneği bulunur:

Keep

Sell

Craft

Örneğin:

Legendary Crystal ✓

Collection'da zaten varsa ve oyuncu ikinci bir Legendary Crystal elde ederse:

Market'te satabilir,

Crafting materyali olarak kullanabilir,

Duplicate biriktirebilir.

Bu sistem duplicate itemlar için sürekli sink oluşturur.

36. Item Sink
Ekonomide sürekli item üretildiği için item sink'leri bulunmalıdır.

Başlıca sink:

Craft

Fusion

Recipe Craft

Upgrade

Sistem ücretleri

Diğer tüketilebilir crafting mekanikleri

Amaç:

item enflasyonunu azaltmak,

materyallere sürekli talep oluşturmak,

duplicate itemların değerini korumak.

37. Rarity Upgrade / Fusion
İleride aynı itemların birleştirilmesi sistemi değerlendirilebilir.

Örneğin:

3 × Red Crystal
        ↓
1 × Red Crystal
Higher Quality

veya:

3 × Float / Quality Inputs
        ↓
Chance-based Output

Fusion sistemi henüz kesin değildir.

Ana tasarım ilkesi:

Fusion item sink oluşturmalıdır.

Fusion garantili ekonomik kâr üretmemelidir.

38. Seasonal Items
Sezonlar collection ekonomisinin önemli bir parçasıdır.

Örneğin:

Season 1

belirli itemlar yalnızca Season 1 sırasında üretilebilir.

Season bittikten sonra:

Direct Drop Disabled

olabilir.

Itemlar daha sonra:

Steam Market

diğer oyuncuların sahip olduğu supply

bazı özel craft yolları

üzerinden dolaşabilir.

Amaç:

Limited Supply

oluşturmaktır.

39. Supply
Bazı itemlarda total supply takip edilebilir.

Örneğin:

Ancient Crown

Total Generated: 184
Currently Owned: 184
Market Listings: 7

Season sonunda yeni üretim durursa supply sabitlenebilir.

Bu itemın koleksiyon değerini artırabilir.

Supply, Float ve Tier'dan bağımsız bir ekonomik parametredir.

40. Special / Non-Farmable Items
Bazı collection itemları normal farm yoluyla elde edilemez.

Örneğin:

Item A → Farm
Item B → Farm
Item C → Craft
Item D → Recipe Craft
Item E → Season
Item F → Event

Bu yapı collection'ın tamamlanmasını çok yönlü hale getirir.

Amaç:

"Sadece saatlerce farm yapan oyuncu her itemı elde edemesin."

41. Market / Player Economy — Güncel Yaklaşım
İlk aşamada market ekonomisinin Steam Community Market üzerine kurulması değerlendirilecektir.

Temel ekonomik döngü:

FARM
 ↓
ITEM
 ↓
COLLECTION / CRAFT
 ↓
DUPLICATE
 ↓
STEAM MARKET
 ↓
STEAM WALLET

Collector tarafında:

FARM
 ↓
Eksik Collection Item
 ↓
STEAM MARKET
 ↓
SATIN AL
 ↓
COLLECTION COMPLETE

Bu sayede:

farm yapan oyuncu,

collector,

crafter

arasında doğal ekonomik ilişki oluşur.

Oyunun kendi P2P trade sistemini ilk aşamada geliştirmek zorunlu değildir.

42. Steam Inventory / Market Uyumluluğu
Steam Inventory Service item instance bazında dynamic properties desteklediği için Float gibi değerlerin Steam tarafında tutulması teknik olarak değerlendirilebilir.

Örnek:

Steam Item Instance

ItemDef:
Mythic Void Crown

Instance ID:
123456789

Dynamic Properties:
float = 0.01372
season = 1

Ancak kritik nokta:

Steam Community Market'in dynamic property'leri standart market görünümünde nasıl gösterdiğinin ve farklı instance'ların nasıl ayrıştırıldığının doğrulanmasıdır.

Bu nedenle Float sistemini oyunun ekonomik merkezine koymadan önce Steam tarafında teknik PoC yapılmalıdır.

43. Steam Market'in Oyunu Bypass Etmemesi
Market oyuncunun:

farm,

craft,

collection

sistemlerini tamamen gereksiz hale getirmemelidir.

Oyuncunun her itemı marketten satın alması mümkün olsa bile:

Farm yapmak ekonomik olarak anlamlı kalmalıdır.

Aynı şekilde farm yapan oyuncunun elde ettiği itemların:

Market üzerinde gerçek talebi

olmalıdır.

Market:

collection eksiklerini tamamlamayı,

duplicate itemları değerlendirmeyi,

ekonomik kararları

desteklemelidir.

Oyunun core loop'unu ortadan kaldırmamalıdır.

44. Technical Prototype Priority
Steam entegrasyonu için erken aşamada küçük bir teknik PoC hazırlanmalıdır.

Test itemı:

Mythic Test Item

En az üç farklı instance:

Instance A
Float: 0.01372

Instance B
Float: 0.48291

Instance C
Float: 0.00124

test edilmelidir.

PoC ile doğrulanması gerekenler:

Item instance oluşturma

Float dynamic property kaydetme

Float property okuma

Tradable item

Marketable item

Steam Trade transferi

Community Market listing

Market alıcısının item Float değerini görebilmesi

Farklı Float değerlerine sahip aynı ItemDef instance'larının markette nasıl ayrıştırıldığı

Satın alınan itemın Float bilgisinin korunması

Bu PoC tamamlanmadan:

Float + Steam Market

oyunun kesin ekonomik mimarisi olarak kabul edilmemelidir.

45. Social Area
Farm alanı yalnızca farm yapılan bir instance değildir.

Aynı zamanda:

Social Room

olarak çalışır.

Oyuncular:

farm yapabilir,

chat yapabilir,

diğer oyuncuların karakterlerini görebilir,

collectionlarını inceleyebilir,

showcase'lerini görebilir.

46. Chat
Chat sisteminin amacı farm alanlarını sosyal hale getirmektir.

Oyuncular aynı anda:

farm + sohbet

yapabilmelidir.

Keyboard input ile farm yapılıyorsa chat input'unun farm input'uyla çakışmaması gerekir.

Örneğin:

SPACE = Farm

Chat açıldığında:

SPACE = Chat Input

olabilir.

47. Player Interaction
Oyuncuya tıklanınca:

Player Name
Collection Score
View Collection
View Profile

gibi seçenekler açılabilir.

Inventory gösterilmez.

Recipe Knowledge gösterilmez.

48. Currently Hunting / Wanted Item
Oyuncu collection'dan bir item seçip:

Currently Hunting

olarak işaretleyebilir.

Örneğin:

🎯 Looking for: Ancient Ruby

Diğer oyuncular bunu görebilir.

Bu sistem:

sosyal konuşmayı,

market işlemlerini,

oyuncular arası yardımı

teşvik eder.

49. Auto-Farm
Oyunda Auto-Farm sistemi bulunabilir.

Auto-Farm:

oyuncu yerine belirli süre boyunca farm action üretir,

oyuncunun sürekli tıklamasını gerektirmez.

Ancak Auto-Farm:

Active Farm'dan daha verimli olmamalıdır.

Örnek:

Active Farm = 100% efficiency
Auto Farm = 60–80% efficiency

Kesin oran daha sonra belirlenecek.

Auto-Farm'ın temel avantajı:

Oyuncunun farm yaparken sohbet edebilmesi veya başka işle ilgilenebilmesidir.

50. Booster Sistemi
Farm sırasında booster itemları düşebilir.

Örnek:

10 Minute Auto-Farm

+Luck

+Drop Chance

Boosterlar:

farmdan düşebilir,

Steam Market'te satılabilir,

oyuncu tarafından kullanılabilir,

bazı boosterlar oyun içi satın alma ile elde edilebilir.

51. Booster Ekonomisi
Boosterlar item ekonomisinin parçasıdır.

Örneğin:

10 Min Auto Farm

oyuncuya düşebilir.

Oyuncu:

Use

Sell

seçeneklerine sahip olabilir.

Böylece booster da tradeable ekonomik kaynak haline gelir.

52. Booster Stacking
Boosterların sınırsız şekilde üst üste bindirilmesi engellenmelidir.

Örneğin:

Luck buff

Drop buff

Auto-Farm buff

aynı anda çalışabilir.

Ancak aynı tip buff'ın sınırsız stacking yapması engellenmelidir.

Kesin stacking kuralları ekonomi simülasyonu sonrasında belirlenecek.

53. Monetization
Ana monetization:

Convenience + Cosmetic

olmalıdır.

Oyuncunun gerçek para ile doğrudan:

"Legendary Item satın alması"

tercih edilmez.

Özellikle:

Gerçek Para → Doğrudan Yüksek Tier / Yüksek Float

modelinden kaçınılmalıdır.

Monetization oyuncuya:

zaman,

convenience,

cosmetic personalization

satmalıdır.

Oyunun ekonomik değerini doğrudan satmamalıdır.

54. Paid Booster
Örneğin:

2 Hour Auto-Farm

gerçek para ile satın alınabilir.

Ancak mümkünse benzer sistemlerin oyun içinde de elde edilebilir olması tercih edilir.

Paid booster:

doğrudan yüksek Tier vermemeli,

doğrudan yüksek Float vermemeli,

garantili ekonomik kâr sağlamamalıdır.

55. Premium / Cosmetic Monetization
Potansiyel premium ürünler:

Auto-Farm Duration

Profile Customization

Collection Frame

Character Effects

Chat Effects

Emotes

Titles

Showcase Customization

Cosmetic Items

Drop rate'in gerçek para ile doğrudan artırılması dikkatli değerlendirilmelidir.

56. Collection Completion Ödülleri
Collection tamamlamak oyuncuya:

Title

Badge

Cosmetic

Profile Frame

Emote

Character Effect

gibi prestige ödülleri verebilir.

Bu ödüllerin market ekonomisini bozmaması tercih edilir.

57. Market Karar Döngüsü
Oyuncu bir item elde ettiğinde temel seçenekleri:

KEEP
SELL
CRAFT

Duplicate itemlarda:

KEEP
SELL
CRAFT / SINK

kararı verilir.

Örneğin:

"Bu item $5 ediyor. Satayım mı, yoksa craft için biriktireyim mi?"

Bu karar mekanizması oyunun ekonomik core loop'larından biridir.

58. Ekonomi İlkeleri
Hiçbir sistem:

"Oyuncu X bunu yaptı ve garantili olarak harcadığından daha değerli bir item aldı."

şeklinde sonsuz değer üretmemelidir.

Her üretim mekanizmasında:

Input Value

Output Probability

Supply

Demand

Market Fee

Craft Cost

Item Sink

Acquisition Rate

dikkate alınmalıdır.

Ana hedef:

Beklenen değer üzerinden kontrollü ekonomi.

59. Bot / Macro Koruması
Farm mekanizması server-authoritative olmalıdır.

Server:

valid action rate,

cooldown,

movement,

room state,

player state

kontrol eder.

Client tarafından gönderilen:

"Reward ver."

gibi bir komut kabul edilmez.

60. İlk MVP
İlk playable versiyonda yalnızca:

World
1 Zone

1 Farm Object

10-player rooms

Items
15–30 item

5 Tier

Float system

Systems
Farm

XP

Level

Collection

Public Profile

Chat

Basic Craft

Recipe

Basic Market Prototype

Auto-Farm

2–3 Booster

Technical
Server-authoritative player state

Item instance system

Basic RNG / Float generation

Steam Inventory PoC

yeterlidir.

Steam Community Market gerçek ekonomik sisteme alınmadan önce PoC ile doğrulanmalıdır.

61. MVP'de Olmaması Gerekenler
İlk prototipte:

yüksek kaliteli 3D assetler,

özel VFX,

büyük world,

yüzlerce zone,

yüzlerce cosmetic,

gelişmiş animation,

kompleks quest sistemi

gerekmez.

Free / simple assetler kullanılabilir.

Öncelik:

Ekonomi + Core Loop + Multiplayer + Item Instance sistemi

olmalıdır.

62. Teknik Öncelik
İlk geliştirilecek sistemler:

Server-authoritative player state

Room / Multiplayer

Farm Action

XP

Drop System

Item Instance

Tier + Float

Inventory

Collection

Recipe / Crafting

Player Profile

Chat

Market Simulation

Auto-Farm

Booster

Steam Inventory PoC

Steam Market PoC

Steam entegrasyonu gerçek ekonomiye geçmeden önce teknik olarak doğrulanmalıdır.

63. Oyunun Ana Loop'u
JOIN
 ↓
ENTER FARM ZONE
 ↓
FARM
 ↓
XP + ITEM INSTANCE
 ↓
TIER + FLOAT
 ↓
NEW COLLECTION ITEM?
 ↓
YES → COLLECTION
 ↓
NO → DUPLICATE
 ↓
ITEM KARARI
 ├── KEEP
 ├── SELL
 └── CRAFT
       ↓
     RECIPE?
       ↓
      YES
       ↓
   MATERIALS?
       ↓
      YES
       ↓
     CRAFT
       ↓
 NEW TIER / FLOAT ROLL
       ↓
 NEW COLLECTION / MARKET / SINK

64. Sosyal Loop
FARM
 ↓
SEE OTHER PLAYERS
 ↓
VIEW COLLECTION
 ↓
COMPARE
 ↓
"BENDE BU YOK"
 ↓
HUNT / MARKET / CRAFT
 ↓
COLLECTION SCORE ↑

65. Discovery Loop
FARM
 ↓
RARE RECIPE DROP
 ↓
LEARN / SELL
 ↓
CRAFTING ACCESS
 ↓
RARE ITEM
 ↓
COLLECTION / MARKET

66. Collection Hunting Loop
VIEW COLLECTION
 ↓
MISSING ITEM
 ↓
CURRENTLY HUNTING
 ↓
FARM / CRAFT / MARKET
 ↓
ITEM ACQUIRED
 ↓
COLLECTION COMPLETE
 ↓
PRESTIGE REWARD
 ↓
NEW COLLECTION TARGET

67. Oyunun Temel Tasarım İlkeleri
Principle 1 — Farm tek başına amaç değildir.
Farm, collection ve economy için araçtır.

Principle 2 — Collection public, inventory private.
Oyuncular birbirlerinin koleksiyonlarını inceleyebilmelidir.

Principle 3 — Tier ve Float farklı sistemlerdir.
Tier itemın temel sınıfıdır.

Float item instance'ının kondisyon / kalite değeridir.

Principle 4 — Drop Rate, Tier ve Float birbirinden bağımsızdır.
Çok zor çıkan item yüksek Tier olmak zorunda değildir.

İyi Float yüksek Tier anlamına gelmez.

Principle 5 — Float market fiyatı değildir.
Market fiyatını:

supply,

demand,

Tier,

Float,

collection importance,

acquisition difficulty

gibi faktörler belirleyebilir.

Principle 6 — Recipe gerçek bir ekonomik varlıktır.
Recipe öğrenmek crafting hakkı verir.

Principle 7 — Recipe olmadan craft yoktur.
İnternette recipe görmek crafting yetkisi sağlamaz.

Principle 8 — Recipe Knowledge private'tır.
Bir oyuncunun hangi recipe'leri bildiği public değildir.

Principle 9 — Item üretiminin bir maliyeti olmalıdır.
Craft ve diğer sink mekanikleri sürekli supply artışını kontrol etmelidir.

Principle 10 — Craft garantili ekonomik kâr üretmemelidir.
Craft:

Risk / Reward + Item Sink

mekaniğidir.

Principle 11 — Collection sosyal statü üretmelidir.
Collection Score, showcase, Tier, Float ve completion oyuncunun sosyal statüsünü oluşturur.

Principle 12 — Sezonlar sınırlı supply oluşturabilir.
Season itemları daha sonra player-driven economy üzerinden dolaşabilir.

Principle 13 — Gerçek para doğrudan ekonomik rarity satmamalıdır.
Monetization ağırlıklı olarak convenience ve cosmetics üzerinden ilerlemelidir.

Principle 14 — Steam Market oyunun core loop'unu bypass etmemelidir.
Market farm ve collection ekonomisini desteklemeli, ortadan kaldırmamalıdır.

Principle 15 — Steam + Float mimarisi PoC ile doğrulanmalıdır.
Steam Community Market'in dynamic Float değerleriyle gerçekten istenen ekonomik modeli desteklediği doğrulanmadan sistem kesinleştirilmemelidir.

68. Şu An Kesinleşmemiş Parametreler
Bunlar sistemin parçasıdır ancak rakamları henüz belirlenmemiştir:

Zone sayısı

Zone unlock level'ları

Farm action cooldown

XP miktarları

Item drop rate'leri

Tier dağılımları

Float generation dağılımı

Item-specific Float range

Float'ın Collection Score'a etkisi

Craft maliyetleri

Craft Float probability'leri

Recipe drop rate'leri

Recipe market fiyatlarının davranışı

Auto-Farm efficiency

Booster süreleri

Booster stacking

Collection completion ödülleri

Collection Score formülü

Seasonal duration

Seasonal supply

Market fee

Steam Item Definition yapısı

Steam dynamic property davranışı

Steam Market'te Float görünürlüğü

Float instance ayrıştırma yöntemi

Fusion sisteminin olup olmayacağı

Premium ürünlerin kesin kapsamı

Paid Booster kapsamı

Bu değerler ekonomi simülasyonu, Steam PoC ve playtest sonrasında belirlenmelidir.

69. Bir Sonraki Aşama — Ekonomi Simülasyonu
Bir sonraki aşamada ekonominin matematiksel modeli oluşturulmalıdır.

Özellikle:

100 oyuncunun 1 saatte kaç farm action ürettiği,

saatlik item generation,

Tier bazında item generation,

Float distribution,

Mythic item üretim miktarı,

belirli bir Float kalitesinin oluşma ihtimali,

recipe generation,

recipe'nin beklenen ekonomik değeri,

craft input cost,

craft output expected value,

duplicate generation,

item sink rate,

market fee,

market liquidity,

30 / 90 / 180 günlük supply,

seasonal supply,

item inflation,

collector demand,

crafter demand,

farm profitability,

Steam Market liquidity

matematiksel olarak simüle edilmelidir.

