# client

Unity 6 (6000.6) projesi, Universal 2D şablonu.

- Açmak: Unity Hub → Add → Add project from disk → bu `client/` klasörü.
- Nakama SDK `Packages/manifest.json` içinde (git paketi, sürüm sabit).
- Play'e basınca `NakamaHealthcheck` yerel sunucuya bağlanıp Console'a sonucu yazar. Önce repo kökünde `docker compose up -d`.

Kod düzeni: `Assets/Scripts/Net/` (Nakama bağlantısı, `Protocol.cs`), `Assets/Scripts/World/`, `Assets/Scripts/UI/`.
