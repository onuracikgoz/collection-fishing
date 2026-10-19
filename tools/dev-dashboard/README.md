# Dev Dashboard

Yerel Nakama'ya bağlanan, oyundaki her sistemi test etmeye yarayan tek sayfalık geliştirici aracı. Sadece `DEV_TOOLS=true` olan yerel sunucuda çalışır.

```bash
docker compose up -d
node tools/dev-dashboard/serve.mjs   # http://127.0.0.1:7360
```

Kullanım ve dev RPC'leri: [`docs/araclar/dev-dashboard.md`](../../docs/araclar/dev-dashboard.md).
