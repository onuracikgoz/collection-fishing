using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.World;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.Economy
{
    /// <summary>
    /// Pet stalls and the Market Board on the client (docs/protokol.md, Pazar and Pazar Panosu;
    /// drafts tezgah-kur, tezgah-tezgah, tezgah-pano). Sends intents only: STALL_OPEN / RECALL /
    /// VIEW / BUY, BOARD_AD / GOTO. Prices, fees, Coin, diamonds and every outcome come from the
    /// server. No buy listings (decision 29.10.2026).
    ///
    /// M opens the market window (my stall and the board). Stalls are drawn on the map at their
    /// pet's spot; click one to see its full list.
    /// </summary>
    public sealed class MarketController
    {
        public enum Tab { Stall, Board }

        /// <summary>
        /// Display only: within this many tiles the map label also lists the first entries
        /// (ui-uygulama.md, Pazar). The server's MARKET.interactRadius decides view and buy.
        /// </summary>
        const float NearTiles = 7f;

        readonly Connection net;
        readonly FishingController fishing;
        readonly Func<Prices> prices;
        readonly Func<Vector2?> myPosition;
        readonly KitWindow window = new KitWindow("Pazar", 640, 430);
        readonly KitWindow stallWindow = new KitWindow("Tezgah", 560, 400);

        public bool Open { get; set; }
        public Tab Current { get; set; }
        public Dictionary<string, StallView> Stalls { get; } = new Dictionary<string, StallView>();
        public List<BoardAd> Ads { get; } = new List<BoardAd>();
        public StallListMsg Viewing { get; private set; }
        public StallResultMsg LastResult { get; private set; }
        public BoardResultMsg LastBoard { get; private set; }

        public Action<string> OpenProfile { get; set; }
        /// <summary>(userId, name, context): opens a whisper window.</summary>
        public Action<string, string, string> Whisper { get; set; }
        public Action<string, string> AddFriend { get; set; }
        public Action<FishEndMsg> BookOutcome { get; set; }

        public StallView MyStall => net.UserId != null && Stalls.TryGetValue(net.UserId, out var s) ? s : null;
        public bool MyAd => Ads.Any(a => a.userId == net.UserId);
        public long Diamond => fishing.Bag?.diamond ?? 0;

        // Stall setup.
        string title = "";
        readonly Dictionary<string, string> itemPrice = new Dictionary<string, string>();
        readonly Dictionary<string, string> stackCount = new Dictionary<string, string>();
        readonly Dictionary<string, string> stackPrice = new Dictionary<string, string>();
        /// <summary>What I put in my last stall (for ad highlights): Float items by instanceId, stacks by defId.</summary>
        readonly List<BoardHighlight> offered = new List<BoardHighlight>();
        readonly HashSet<int> highlightPick = new HashSet<int>();
        bool adPanel;
        // Buying.
        readonly Dictionary<string, int> buyCount = new Dictionary<string, int>();
        string armedBuy;
        float gotoAt = -10f;
        Vector2 scroll, scroll2;

        public MarketController(Connection net, FishingController fishing, Func<Prices> prices, Func<Vector2?> myPosition)
        {
            this.net = net;
            this.fishing = fishing;
            this.prices = prices;
            this.myPosition = myPosition;
        }

        // ---------- input ----------

        public void Update(bool typing)
        {
            var k = Keyboard.current;
            if (typing || k == null) return;
            if (k.mKey.wasPressedThisFrame)
            {
                if (Open) Close();
                else Show(MyStall != null || Ads.Count == 0 ? Tab.Stall : Tab.Board);
            }
        }

        public void Show(Tab tab)
        {
            Open = true;
            Current = tab;
            adPanel = false;
            fishing.RefreshBag();
        }

        void Close()
        {
            Open = false;
            GUIUtility.keyboardControl = 0;
        }

        public void ViewStall(string userId) => net.Send(OpCode.StallView, new StallBuyMsg { userId = userId });

        // ---------- server ----------

        public void OnStallState(StallsMsg m)
        {
            if (m.full) Stalls.Clear();
            foreach (var id in m.removed ?? Array.Empty<string>())
            {
                Stalls.Remove(id);
                if (Viewing != null && Viewing.userId == id) Viewing = null;
            }
            foreach (var s in m.stalls ?? Array.Empty<StallView>()) Stalls[s.userId] = s;
        }

        public void OnStallList(StallListMsg m)
        {
            var opening = Viewing == null || Viewing.userId != m.userId;
            Viewing = m;
            stallWindow.Title = $"{m.name} tezgahı";
            if (opening)
            {
                stallWindow.Center();
                buyCount.Clear();
                armedBuy = null;
            }
        }

        public void OnStallResult(StallResultMsg r)
        {
            LastResult = r;
            Debug.Log($"[Market] STALL_RESULT {r.action} ok {r.ok} {r.reason}");
            if (!r.ok)
            {
                Toasts.Show(Reason(r.reason), true);
                return;
            }
            switch (r.action)
            {
                case "open":
                    Toasts.Show("Tezgah açıldı: petin senin yerine satıyor");
                    itemPrice.Clear();
                    stackCount.Clear();
                    stackPrice.Clear();
                    break;
                case "recall":
                    var back = (r.returned?.items?.Length ?? 0) + (r.returned?.stacks?.Length ?? 0);
                    Toasts.Show(r.reason == "EXPIRED" ? $"Tezgahın süresi doldu, {back} kalem çantana döndü" : $"Pet geri geldi, {back} kalem çantana döndü");
                    offered.Clear();
                    break;
                case "buy":
                    var what = r.item != null && !string.IsNullOrEmpty(r.item.instanceId)
                        ? FishingController.ItemName(r.item.defId)
                        : $"{FishingController.ItemName(r.defId)} x{r.count}";
                    Toasts.Show($"Aldın: {what} (-{Kit.Num(r.paid)} Coin)");
                    if (fishing.Bag != null) fishing.Bag.coin = r.coin;
                    if (r.item != null && !string.IsNullOrEmpty(r.item.instanceId) && r.book != null && !string.IsNullOrEmpty(r.book.page))
                        BookOutcome?.Invoke(new FishEndMsg { id = net.UserId, outcome = FishOutcome.Caught, defId = r.item.defId, item = r.item, book = r.book });
                    armedBuy = null;
                    break;
            }
            fishing.RefreshBag();
        }

        public void OnBoardState(BoardStateMsg m)
        {
            if (m.full) Ads.Clear();
            var removed = new HashSet<string>(m.removed ?? Array.Empty<string>());
            foreach (var a in m.ads ?? Array.Empty<BoardAd>()) removed.Add(a.userId);
            Ads.RemoveAll(a => removed.Contains(a.userId));
            Ads.AddRange(m.ads ?? Array.Empty<BoardAd>());
            Ads.Sort((a, b) => a.startedAt.CompareTo(b.startedAt)); // oldest first, as the server lists them
        }

        public void OnBoardResult(BoardResultMsg r)
        {
            LastBoard = r;
            Debug.Log($"[Market] BOARD_RESULT {r.action} ok {r.ok} {r.reason} diamond {r.diamond}");
            if (!r.ok)
            {
                Toasts.Show(Reason(r.reason), true);
                return;
            }
            if (r.diamond > 0 && fishing.Bag != null) fishing.Bag.diamond = r.diamond;
            Toasts.Show(r.action == "remove" ? "İlan panodan kaldırıldı" : "İlanın panoda");
            adPanel = false;
            if (r.action == "set") fishing.RefreshBag(); // the diamond balance when it came back 0
        }

        /// <summary>TELEPORT right after a board click is ours. Returns true when handled.</summary>
        public bool OnTeleport(TeleportMsg t)
        {
            if (Time.time - gotoAt > 3f) return false;
            gotoAt = -10f;
            if (string.IsNullOrEmpty(t.reason))
            {
                Open = false;
                return true;
            }
            Toasts.Show(t.reason == "NOT_HERE" ? "Bu ilan artık yok" : t.reason == "NO_SPOT" ? "Tezgahın yanında boş yer yok" : t.reason == "RATE_LIMITED" ? "Biraz bekle, sonra tekrar dene" : $"Gidilemedi ({t.reason})", true);
            return true;
        }

        /// <summary>Own FISH_END: a dropped diamond moves the balance.</summary>
        public void OnFishEnd(FishEndMsg e)
        {
            if (e.diamond != null && e.diamond.gained > 0)
            {
                if (fishing.Bag != null) fishing.Bag.diamond = e.diamond.total;
                Toasts.Show($"Elmas buldun! (+{e.diamond.gained})");
            }
        }

        /// <summary>Notification 103: someone bought from my stall.</summary>
        public void OnSold(StallSoldNotice n)
        {
            var what = n.count > 1 ? $"{FishingController.ItemName(n.defId)} x{n.count}" : FishingController.ItemName(n.defId);
            Toasts.Show($"Tezgahından satıldı: {what} → {n.buyer}, +{Kit.Num(n.price - n.fee)} Coin");
            fishing.RefreshBag();
        }

        static string Reason(string r)
        {
            switch (r)
            {
                case "BAD_REQUEST": return "İstek geçersiz";
                case "TOO_MANY": return "Tezgaha daha fazla kalem konamaz";
                case "BAD_PRICE": return "Fiyat geçersiz";
                case "NOT_OWNED": return "Eşya çantanda değil";
                case "NOT_ENOUGH": return "O kadar yok ya da Coin yetmiyor";
                case "LOCKED": return "Kilitli eşya tezgaha konamaz";
                case "LEVEL_TOO_LOW": return "Pazar için levelin yetmiyor";
                case "TRADE_LOCKED": return "Hesabına yeni giriş yolu bağlandı: pazar bir süre kapalı";
                case "NOT_IN_MARKET": return "Tezgahı pazar alanında açabilirsin";
                case "NO_SPOT": return "Pazar alanında boş yer yok";
                case "ALREADY_OPEN": return "Zaten açık bir tezgahın var (başka sunucuda olabilir)";
                case "BUSY": return "Takas açıkken tezgah açılmaz";
                case "OTHER_SERVER": return "Tezgahın başka sunucuda: geri çağırmak için oraya dön";
                case "NOT_OPEN": return "Açık tezgahın yok";
                case "TOO_FAR": return "Tezgaha yaklaş";
                case "NOT_FOUND": return "Bu kalem satılmış ya da tezgah kalkmış";
                case "BAG_FULL": return "Çanta dolu";
                case "OWN_STALL": return "Kendi tezgahından alamazsın";
                case "NO_STALL": return "İlan için bu sunucuda açık tezgahın olmalı";
                case "NOT_IN_STALL": return "Seçtiğin kalem tezgahta yok";
                case "BOARD_FULL": return "Pano dolu, sonra tekrar dene";
                case "NOT_ENOUGH_DIAMOND": return "Elmasın yetmiyor";
                case "RATE_LIMITED": return "Biraz bekle";
                default: return $"Olmadı ({r})";
            }
        }

        // ---------- map ----------

        GUIStyle markerStyle;

        GUIStyle MarkerStyle
        {
            get
            {
                if (markerStyle != null && markerStyle.normal.background == Kit.Dark.normal.background) return markerStyle;
                markerStyle = new GUIStyle(Kit.Dark) { fontSize = 11, wordWrap = false };
                markerStyle.normal.textColor = markerStyle.hover.textColor = Color.white;
                markerStyle.hover.background = markerStyle.normal.background;
                return markerStyle;
            }
        }

        /// <summary>Stall labels at each pet's spot. Call from OnGUI.</summary>
        public void DrawMarkers(Camera cam)
        {
            if (cam == null || Stalls.Count == 0) return;
            Kit.Begin();
            var me = myPosition();
            foreach (var s in Stalls.Values)
            {
                var pos = new Vector2(s.x, s.y);
                var at = Gui.ToGui(cam.WorldToScreenPoint(Coords.ToUnity(pos)));
                if (at.x < -100 || at.y < -60 || at.x > Gui.Width + 100 || at.y > Gui.Height + 60) continue;
                var near = me.HasValue && Vector2.Distance(me.Value, pos) <= NearTiles;
                var head = string.IsNullOrEmpty(s.title) ? $"{s.name} tezgahı" : $"\"{s.title}\" · {s.name}";
                var text = head;
                if (near && s.top != null && s.top.Length > 0)
                    text += "\n" + string.Join("\n", s.top.Select(e => $"{ItemText.Entry(e)}  {Kit.Num(e.price)}")) + (s.total > s.top.Length ? $"\n+{s.total - s.top.Length} kalem" : "");
                var content = new GUIContent(text);
                var w = Mathf.Max(MarkerStyle.CalcSize(content).x + 4f, 60f);
                var h = MarkerStyle.CalcHeight(content, w);
                var r = new Rect(at.x - w / 2f, at.y - h - 4f, w, h);
                Gui.Block(r);
                if (GUI.Button(r, content, MarkerStyle)) ViewStall(s.userId);
            }
        }

        // ---------- UI ----------

        public void DrawGui()
        {
            if (Viewing != null) DrawStallList();
            if (!Open) return;
            if (!window.Begin())
            {
                window.End();
                Close();
                return;
            }
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Tezgahım", Current == Tab.Stall ? Kit.TabOn : Kit.Tab, GUILayout.Width(110), GUILayout.Height(22))) Current = Tab.Stall;
            if (GUILayout.Button($"Pazar Panosu ({Ads.Count})", Current == Tab.Board ? Kit.TabOn : Kit.Tab, GUILayout.Width(150), GUILayout.Height(22))) Current = Tab.Board;
            GUILayout.FlexibleSpace();
            GUILayout.Label($"{Kit.Num(fishing.Bag?.coin ?? 0)} Coin   ·   {Kit.Num(Diamond)} elmas", Kit.Bold);
            GUILayout.EndHorizontal();
            GUILayout.Space(4);
            if (Current == Tab.Stall)
            {
                if (MyStall != null) DrawMyStall(MyStall);
                else DrawSetup();
            }
            else DrawBoard();
            window.End();
        }

        // ----- Tezgah kur -----

        void DrawSetup()
        {
            var bag = fishing.Bag;
            if (bag == null)
            {
                GUILayout.Label("Yükleniyor...", Kit.Faint);
                return;
            }
            var p = prices();
            GUILayout.BeginHorizontal();
            GUILayout.Label("Başlık", Kit.Text, GUILayout.Width(50));
            title = GUILayout.TextField(title, 40, Kit.Input, GUILayout.Height(22));
            GUILayout.EndHorizontal();
            GUILayout.Label("Satmak istediğine fiyat yaz (yığında adet başı). Kilitli eşya konamaz.", Kit.Faint);

            scroll = GUILayout.BeginScrollView(scroll, GUILayout.Height(250));
            foreach (var it in (bag.items ?? Array.Empty<ItemInstance>()).OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId))
            {
                GUILayout.BeginHorizontal(Kit.Card);
                Kit.TierMark(it.tier, it.locked ? "kilit" : "");
                GUILayout.Label(ItemText.Long(it, p), Kit.Small);
                GUI.enabled = !it.locked;
                itemPrice.TryGetValue(it.instanceId, out var price);
                price = Digits(GUILayout.TextField(price ?? "", 10, Kit.Input, GUILayout.Width(80), GUILayout.Height(20)));
                if (price.Length > 0) itemPrice[it.instanceId] = price;
                else itemPrice.Remove(it.instanceId);
                GUILayout.Label("Coin", Kit.Faint, GUILayout.Width(30));
                GUI.enabled = true;
                GUILayout.EndHorizontal();
            }
            foreach (var st in bag.stacks ?? Array.Empty<ItemStack>())
            {
                GUILayout.BeginHorizontal(Kit.Card);
                Kit.TierMark(null, st.count.ToString());
                GUILayout.Label(FishingController.ItemName(st.defId), Kit.Small);
                stackCount.TryGetValue(st.defId, out var n);
                GUILayout.Label("adet", Kit.Faint, GUILayout.Width(28));
                n = Digits(GUILayout.TextField(n ?? "", 6, Kit.Input, GUILayout.Width(44), GUILayout.Height(20)));
                if (n.Length > 0) stackCount[st.defId] = n;
                else stackCount.Remove(st.defId);
                stackPrice.TryGetValue(st.defId, out var sp);
                GUILayout.Label("tanesi", Kit.Faint, GUILayout.Width(36));
                sp = Digits(GUILayout.TextField(sp ?? "", 10, Kit.Input, GUILayout.Width(70), GUILayout.Height(20)));
                if (sp.Length > 0) stackPrice[st.defId] = sp;
                else stackPrice.Remove(st.defId);
                GUILayout.EndHorizontal();
            }
            if ((bag.items?.Length ?? 0) + (bag.stacks?.Length ?? 0) == 0) GUILayout.Label("Çanta boş", Kit.Faint);
            GUILayout.EndScrollView();

            var items = itemPrice.Where(x => int.TryParse(x.Value, out var v) && v > 0 && (bag.items ?? Array.Empty<ItemInstance>()).Any(i => i.instanceId == x.Key && !i.locked))
                .Select(x => new StallOpenItem { instanceId = x.Key, price = int.Parse(x.Value) }).ToArray();
            var stacks = stackPrice.Where(x => int.TryParse(x.Value, out var v) && v > 0 && stackCount.TryGetValue(x.Key, out var c) && int.TryParse(c, out var cn) && cn > 0)
                .Select(x => new StallOpenStack { defId = x.Key, count = Mathf.Min(int.Parse(stackCount[x.Key]), fishing.StackCount(x.Key)), price = int.Parse(x.Value) })
                .Where(s => s.count > 0).ToArray();

            GUILayout.FlexibleSpace();
            GUILayout.BeginHorizontal();
            GUILayout.Label($"Tezgahta {items.Length + stacks.Length} kalem. Pet sen oyundan çıkana kadar satar; satıştan pazar ücreti kesilir, satılmayanlar çantana döner.", Kit.Faint, GUILayout.Width(400));
            GUILayout.FlexibleSpace();
            GUI.enabled = items.Length + stacks.Length > 0;
            if (GUILayout.Button("Tezgahı aç", Kit.Green, GUILayout.Width(140), GUILayout.Height(28)))
            {
                net.Send(OpCode.StallOpen, new StallOpenMsg { title = title.Trim(), items = items, stacks = stacks });
                offered.Clear();
                offered.AddRange(items.Select(i => new BoardHighlight { instanceId = i.instanceId, defId = "" }));
                offered.AddRange(stacks.Select(s => new BoardHighlight { instanceId = "", defId = s.defId }));
                highlightPick.Clear();
            }
            GUI.enabled = true;
            GUILayout.EndHorizontal();
        }

        static string Digits(string s) => new string((s ?? "").Where(char.IsDigit).ToArray());

        void DrawMyStall(StallView s)
        {
            GUILayout.BeginVertical(Kit.Card);
            GUILayout.Label(string.IsNullOrEmpty(s.title) ? "Tezgahın açık" : $"\"{s.title}\"", Kit.Header);
            var hours = s.expiresInMs / 3600000f;
            GUILayout.Label($"Yer {s.spot} · {s.total} kalem · kalan süre {(hours >= 1f ? $"{hours:0.#} saat" : $"{s.expiresInMs / 60000} dk")}", Kit.Text);
            foreach (var e in s.top ?? Array.Empty<StallEntry>())
                GUILayout.Label($"{ItemText.Entry(e)}   {Kit.Num(e.price)} Coin{(string.IsNullOrEmpty(e.tier) ? " / adet" : "")}", Kit.Small);
            if (s.total > (s.top?.Length ?? 0)) GUILayout.Label($"+{s.total - s.top.Length} kalem daha", Kit.Faint);
            GUILayout.EndVertical();

            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Tam liste", Kit.Wood, GUILayout.Height(26))) ViewStall(s.userId);
            if (GUILayout.Button("Peti geri çağır", Kit.Red, GUILayout.Height(26))) net.Send(OpCode.StallRecall, new EmptyMsg());
            GUILayout.EndHorizontal();
            GUILayout.Space(8);
            DrawAdControls();
        }

        // ----- Pano -----

        void DrawAdControls()
        {
            if (MyStall == null)
            {
                GUILayout.Label("Tezgahın açıkken kendini panoda ilan edebilirsin (elmasla).", Kit.Faint);
                return;
            }
            if (MyAd)
            {
                GUILayout.BeginHorizontal();
                GUILayout.Label("İlanın panoda. Öne çıkanları değiştirmek ücretsizdir.", Kit.Good);
                if (GUILayout.Button("Öne çıkanlar", Kit.Wood, GUILayout.Width(110), GUILayout.Height(24))) adPanel = !adPanel;
                if (GUILayout.Button("İlanı kaldır", Kit.Red, GUILayout.Width(100), GUILayout.Height(24)))
                    net.Send(OpCode.BoardAd, new BoardAdMsg { action = "remove", highlights = Array.Empty<BoardHighlight>() });
                GUILayout.EndHorizontal();
            }
            else
            {
                GUILayout.BeginHorizontal();
                GUILayout.Label($"Panoya ilan ver: elmasla ödenir, tezgah kapanınca ilan da kalkar (elmasın: {Kit.Num(Diamond)}).", Kit.Faint, GUILayout.Width(400));
                if (GUILayout.Button("Reklam ver", Kit.Wood, GUILayout.Height(24))) adPanel = !adPanel;
                GUILayout.EndHorizontal();
            }
            if (!adPanel) return;

            GUILayout.BeginVertical(Kit.Card);
            if (offered.Count == 0) GUILayout.Label("Öne çıkacak kalemi seçmezsen ilan tezgahın ilk kalemlerini gösterir.", Kit.Faint);
            else
            {
                GUILayout.Label("Öne çıkacak en fazla 3 kalem seç (boş bırakırsan ilk kalemler):", Kit.Small);
                var bag = fishing.Bag;
                for (var i = 0; i < offered.Count; i++)
                {
                    var h = offered[i];
                    var name = !string.IsNullOrEmpty(h.defId) ? FishingController.ItemName(h.defId) : DescribeOffered(h.instanceId);
                    var on = highlightPick.Contains(i);
                    var now = GUILayout.Toggle(on, " " + name, Kit.Text);
                    if (now && !on && highlightPick.Count < 3) highlightPick.Add(i);
                    else if (!now && on) highlightPick.Remove(i);
                }
            }
            GUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            if (GUILayout.Button(MyAd ? "Güncelle" : "İlanı ver (elmas)", Kit.Green, GUILayout.Width(150), GUILayout.Height(26)))
                net.Send(OpCode.BoardAd, new BoardAdMsg { action = "set", highlights = highlightPick.OrderBy(i => i).Select(i => offered[i]).ToArray() });
            GUILayout.EndHorizontal();
            GUILayout.EndVertical();
        }

        string DescribeOffered(string instanceId)
        {
            // The item left the bag for the stall; the last full list of my stall may still name it.
            var it = Viewing != null && Viewing.userId == net.UserId ? Viewing.items?.FirstOrDefault(x => x.item.instanceId == instanceId)?.item : null;
            return it != null ? ItemText.Short(it, prices()) : "Float'lı eşya";
        }

        void DrawBoard()
        {
            GUILayout.Label("İlanlar eskiden yeniye. Tıkla, tezgahın yanına git.", Kit.Faint);
            scroll2 = GUILayout.BeginScrollView(scroll2, GUILayout.Height(270));
            if (Ads.Count == 0) GUILayout.Label("Panoda ilan yok.", Kit.Text);
            foreach (var a in Ads)
            {
                GUILayout.BeginHorizontal(Kit.Card);
                GUILayout.BeginVertical();
                GUILayout.Label(string.IsNullOrEmpty(a.title) ? $"{a.name} tezgahı" : $"\"{a.title}\"", Kit.Bold);
                GUILayout.Label($"{a.name} tezgahı · {a.total} kalem", Kit.Faint);
                GUILayout.BeginHorizontal();
                foreach (var e in a.top ?? Array.Empty<StallEntry>())
                {
                    Kit.TierMark(e.tier);
                    GUILayout.Label($"{ItemText.Entry(e)} {Kit.Num(e.price)}", Kit.Small, GUILayout.Width(130));
                }
                GUILayout.EndHorizontal();
                GUILayout.EndVertical();
                GUILayout.FlexibleSpace();
                GUI.enabled = a.userId != net.UserId;
                if (GUILayout.Button("Yanına git", Kit.Green, GUILayout.Width(100), GUILayout.Height(26)))
                {
                    net.Send(OpCode.BoardGoto, new GotoFriendMsg { userId = a.userId });
                    gotoAt = Time.time;
                }
                GUI.enabled = true;
                GUILayout.EndHorizontal();
            }
            GUILayout.EndScrollView();
            GUILayout.FlexibleSpace();
            DrawAdControls();
            GUILayout.Label("İlan eşya miktarını ya da kalitesini değiştirmez. Alım ilanı yok.", Kit.Faint);
        }

        // ----- Bir tezgahın tam listesi -----

        void DrawStallList()
        {
            var v = Viewing;
            if (!stallWindow.Begin())
            {
                stallWindow.End();
                Viewing = null;
                return;
            }
            var mine = v.userId == net.UserId;
            GUILayout.BeginHorizontal();
            GUILayout.Label(string.IsNullOrEmpty(v.title) ? v.name : $"\"{v.title}\"  ·  {v.name}", Kit.Header);
            GUILayout.FlexibleSpace();
            if (!mine)
            {
                if (GUILayout.Button("Profil", Kit.Wood, GUILayout.Height(22))) OpenProfile?.Invoke(v.userId);
                if (GUILayout.Button("Fısılda", Kit.Wood, GUILayout.Height(22))) Whisper?.Invoke(v.userId, v.name, "stall");
                if (GUILayout.Button("Arkadaş", Kit.Green, GUILayout.Height(22))) AddFriend?.Invoke(v.userId, v.name);
            }
            GUILayout.EndHorizontal();
            GUILayout.Label($"Coin'in: {Kit.Num(fishing.Bag?.coin ?? 0)}", Kit.Faint);

            var p = prices();
            var coin = fishing.Bag?.coin ?? 0;
            scroll = GUILayout.BeginScrollView(scroll);
            foreach (var li in v.items ?? Array.Empty<StallListItem>())
            {
                if (li.item == null) continue;
                GUILayout.BeginHorizontal(Kit.Card);
                Kit.TierMark(li.item.tier);
                GUILayout.Label(ItemText.Long(li.item, p), Kit.Small);
                GUILayout.Label($"{Kit.Num(li.price)} Coin", Kit.Bold, GUILayout.Width(90));
                var key = "i:" + li.item.instanceId;
                GUI.enabled = !mine && coin >= li.price;
                if (GUILayout.Button(armedBuy == key ? "Emin misin?" : "Satın al", Kit.Green, GUILayout.Width(90), GUILayout.Height(22)))
                {
                    if (armedBuy == key) net.Send(OpCode.StallBuy, new StallBuyMsg { userId = v.userId, instanceId = li.item.instanceId, defId = "", count = 0 });
                    else armedBuy = key;
                }
                GUI.enabled = true;
                GUILayout.EndHorizontal();
            }
            foreach (var st in v.stacks ?? Array.Empty<StallOpenStack>())
            {
                GUILayout.BeginHorizontal(Kit.Card);
                Kit.TierMark(null, st.count.ToString());
                GUILayout.Label($"{FishingController.ItemName(st.defId)} · tanesi {Kit.Num(st.price)}", Kit.Small);
                if (!buyCount.TryGetValue(st.defId, out var n)) n = 1;
                if (GUILayout.Button("-", Kit.Wood, GUILayout.Width(22), GUILayout.Height(20))) n--;
                GUILayout.Label(n.ToString(), Kit.Text, GUILayout.Width(28));
                if (GUILayout.Button("+", Kit.Wood, GUILayout.Width(22), GUILayout.Height(20))) n++;
                if (GUILayout.Button("max", Kit.Flat, GUILayout.Width(36), GUILayout.Height(20))) n = st.count;
                n = Mathf.Clamp(n, 1, Mathf.Max(1, st.count));
                buyCount[st.defId] = n;
                var total = (long)n * st.price;
                var key = $"s:{st.defId}:{n}";
                GUI.enabled = !mine && coin >= total;
                if (GUILayout.Button(armedBuy == key ? "Emin misin?" : $"Al ({Kit.Num(total)})", Kit.Green, GUILayout.Width(100), GUILayout.Height(22)))
                {
                    if (armedBuy == key) net.Send(OpCode.StallBuy, new StallBuyMsg { userId = v.userId, instanceId = "", defId = st.defId, count = n });
                    else armedBuy = key;
                }
                GUI.enabled = true;
                GUILayout.EndHorizontal();
            }
            if ((v.items?.Length ?? 0) + (v.stacks?.Length ?? 0) == 0) GUILayout.Label("Tezgah boş", Kit.Faint);
            GUILayout.EndScrollView();
            GUILayout.Label(mine ? "Kendi tezgahın." : $"Coin {v.name}'e gider, çevrimdışı olsa da. Float'lı eşyada Float ve kondisyon yazar.", Kit.Faint);
            stallWindow.End();
        }
    }
}
