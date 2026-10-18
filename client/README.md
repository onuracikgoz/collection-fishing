# client

Unity 6 projesi buraya gelecek.

Oluşturma (bir kez, Onur):
1. Unity Hub → New project → **Universal 2D** şablonu, Unity 6 LTS.
2. Konum: bu `client/` klasörü (proje adını `client` ver, Hub klasörü kendisi açar; ya da başka yerde açıp içeriğini buraya taşı).
3. Package Manager → Add package from git URL: `https://github.com/heroiclabs/nakama-unity.git?path=/Packages/Nakama`

Kod düzeni: `Assets/Scripts/Net/` (Nakama bağlantısı, `Protocol.cs`), `Assets/Scripts/World/`, `Assets/Scripts/UI/`.
