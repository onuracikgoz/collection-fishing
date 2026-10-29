using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
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
        bool hadStall;

        public MarketController(Connection net, FishingController fishing, Func<Prices> prices, Func<Vector2?> myPosition)
        {
            this.net = net;
            this.fishing = fishing;
            this.prices = prices;
            this.myPosition = myPosition;
            fishing.BagChanged += Dirty;
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
            dirty = true;
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
            // The setup form only needs a rebuild when my own stall came or went.
            if (Current == Tab.Board || MyStall != null || hadStall) Dirty();
            hadStall = MyStall != null;
        }

        public void OnStallList(StallListMsg m)
        {
            var opening = Viewing == null || Viewing.userId != m.userId;
            Viewing = m;
            stallDirty = true;
            if (opening)
            {
                buyCount.Clear();
                armedBuy = null;
            }
        }

        public void OnStallResult(StallResultMsg r)
        {
            LastResult = r;
            Dirty();
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
            if (Current == Tab.Board || MyStall != null) dirty = true;
        }

        public void OnBoardResult(BoardResultMsg r)
        {
            LastBoard = r;
            dirty = true;
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
                if (UiRoot.Covers(Gui.ToScreen(r.center))) continue;
                Gui.Block(r);
                if (GUI.Button(r, content, MarkerStyle)) ViewStall(s.userId);
            }
        }

        // ---------- UI (uGUI: Resources/UI/Market and Stall, PanelViews) ----------

        PanelView view, stallView;
        bool dirty = true, stallDirty = true;
        UnityEngine.UI.Text setupCount;
        UnityEngine.UI.Button openButton;

        PanelView Spawn(string name, Action closed)
        {
            var v = UiRoot.Get().Spawn<PanelView>(name);
            if (v == null) return null;
            v.window.Closed = closed;
            v.Open = false;
            return v;
        }

        public void Destroy()
        {
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
            if (stallView != null) UnityEngine.Object.Destroy(stallView.gameObject);
        }

        void Dirty()
        {
            dirty = true;
            stallDirty = true;
        }

        public void Tick()
        {
            if (view == null) view = Spawn("Market", Close);
            if (stallView == null) stallView = Spawn("Stall", () => Viewing = null);
            if (view == null || stallView == null) return;
            if (view.Open != Open)
            {
                view.Open = Open;
                dirty = true;
            }
            if (stallView.Open != (Viewing != null))
            {
                stallView.Open = Viewing != null;
                stallDirty = true;
            }
            // A rebuild would drop the field being typed in; wait until it is left.
            if (UiRoot.Typing) return;
            if (Open && dirty) Redraw(view);
            if (Viewing != null && stallDirty) RedrawStall(stallView);
        }

        void Redraw(PanelView v)
        {
            dirty = false;
            setupCount = null;
            openButton = null;
            v.ClearRows();
            v.ClearFooter();
            v.Tabs(new[] { "Tezgahım", $"Pazar Panosu ({Ads.Count})" }, (int)Current, i =>
            {
                Current = (Tab)i;
                adPanel = false;
                dirty = true;
            });
            v.headerRight.text = $"{Kit.Num(fishing.Bag?.coin ?? 0)} Coin · {Kit.Num(Diamond)} elmas";
            v.footer.text = "";
            if (Current == Tab.Stall)
            {
                if (MyStall != null) DrawMyStall(v, MyStall);
                else DrawSetup(v);
            }
            else DrawBoard(v);
        }

        // ----- Tezgah kur -----

        void DrawSetup(PanelView v)
        {
            v.header.text = "Tezgah kur";
            var bag = fishing.Bag;
            if (bag == null)
            {
                v.Line("Yükleniyor...");
                return;
            }
            var p = prices();
            v.Row().Title("Başlık").Input(title, 300, t => title = t, 40, false);
            v.Line("Satmak istediğine fiyat yaz (yığında adet başı). Kilitli eşya konamaz.");
            foreach (var it in (bag.items ?? Array.Empty<ItemInstance>()).OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId))
            {
                var id = it.instanceId;
                itemPrice.TryGetValue(id, out var price);
                var row = v.Row().Mark(it.defId, it.tier, 1, it.locked).Title(FishingController.ItemName(it.defId)).Sub(ItemText.Long(it, p));
                if (it.locked) row.Note("kilitli");
                else
                {
                    row.Input(price, 90, t => SetPick(itemPrice, id, t), 10);
                    row.Note("Coin");
                }
            }
            foreach (var st in bag.stacks ?? Array.Empty<ItemStack>())
            {
                var def = st.defId;
                stackCount.TryGetValue(def, out var n);
                stackPrice.TryGetValue(def, out var sp);
                var row = v.Row().Mark(def, "", st.count).Title(FishingController.ItemName(def)).Sub($"çantada {st.count}");
                row.Note("adet");
                row.Input(n, 50, t => SetPick(stackCount, def, t), 6);
                row.Note("tanesi");
                row.Input(sp, 80, t => SetPick(stackPrice, def, t), 10);
            }
            if ((bag.items?.Length ?? 0) + (bag.stacks?.Length ?? 0) == 0) v.Line("Çanta boş");

            v.footer.text = "Pet sen oyundan çıkana kadar satar; satıştan pazar ücreti kesilir, satılmayanlar çantana döner.";
            setupCount = v.Line("", 0, false);
            setupCount.transform.SetParent(v.footerBar, false);
            v.FooterSpace();
            openButton = v.FooterButton("Tezgahı aç", "green", OpenStall, 140);
            UpdateSetupCount();
        }

        void SetPick(Dictionary<string, string> picks, string key, string value)
        {
            value = Digits(value);
            if (value.Length > 0) picks[key] = value;
            else picks.Remove(key);
            UpdateSetupCount();
        }

        (StallOpenItem[] items, StallOpenStack[] stacks) Picks()
        {
            var bag = fishing.Bag;
            var bagItems = bag?.items ?? Array.Empty<ItemInstance>();
            var items = itemPrice.Where(x => int.TryParse(x.Value, out var v) && v > 0 && bagItems.Any(i => i.instanceId == x.Key && !i.locked))
                .Select(x => new StallOpenItem { instanceId = x.Key, price = int.Parse(x.Value) }).ToArray();
            var stacks = stackPrice.Where(x => int.TryParse(x.Value, out var v) && v > 0 && stackCount.TryGetValue(x.Key, out var c) && int.TryParse(c, out var cn) && cn > 0)
                .Select(x => new StallOpenStack { defId = x.Key, count = Mathf.Min(int.Parse(stackCount[x.Key]), fishing.StackCount(x.Key)), price = int.Parse(x.Value) })
                .Where(st => st.count > 0).ToArray();
            return (items, stacks);
        }

        void UpdateSetupCount()
        {
            var (items, stacks) = Picks();
            if (setupCount != null) setupCount.text = $"Tezgahta {items.Length + stacks.Length} kalem";
            if (openButton != null) openButton.interactable = items.Length + stacks.Length > 0;
        }

        void OpenStall()
        {
            var (items, stacks) = Picks();
            if (items.Length + stacks.Length == 0) return;
            net.Send(OpCode.StallOpen, new StallOpenMsg { title = (title ?? "").Trim(), items = items, stacks = stacks });
            offered.Clear();
            offered.AddRange(items.Select(i => new BoardHighlight { instanceId = i.instanceId, defId = "" }));
            offered.AddRange(stacks.Select(st => new BoardHighlight { instanceId = "", defId = st.defId }));
            highlightPick.Clear();
        }

        static string Digits(string s) => new string((s ?? "").Where(char.IsDigit).ToArray());

        void DrawMyStall(PanelView v, StallView s)
        {
            v.header.text = string.IsNullOrEmpty(s.title) ? "Tezgahın açık" : $"\"{s.title}\"";
            var hours = s.expiresInMs / 3600000f;
            v.Line($"Yer {s.spot} · {s.total} kalem · kalan süre {(hours >= 1f ? $"{hours:0.#} saat" : $"{s.expiresInMs / 60000} dk")}", 0, false);
            foreach (var e in s.top ?? Array.Empty<StallEntry>())
                v.Row().Mark(e.defId, e.tier, e.count).Title(ItemText.Entry(e)).Right($"{Kit.Num(e.price)} Coin{(string.IsNullOrEmpty(e.tier) ? " / adet" : "")}");
            if (s.total > (s.top?.Length ?? 0)) v.Line($"+{s.total - s.top.Length} kalem daha");
            DrawAdControls(v);
            v.FooterButton("Tam liste", "wood", () => ViewStall(s.userId));
            v.FooterSpace();
            v.FooterButton("Peti geri çağır", "red", () => net.Send(OpCode.StallRecall, new EmptyMsg()), 140);
        }

        // ----- Pano -----

        void DrawAdControls(PanelView v)
        {
            if (MyStall == null)
            {
                v.Line("Tezgahın açıkken kendini panoda ilan edebilirsin (elmasla).");
                return;
            }
            var row = v.Row();
            if (MyAd)
            {
                row.Title("İlanın panoda").Sub("Öne çıkanları değiştirmek ücretsizdir.");
                row.Button("Öne çıkanlar", "wood", () =>
                {
                    adPanel = !adPanel;
                    dirty = true;
                }, 110);
                row.Button("İlanı kaldır", "red", () => net.Send(OpCode.BoardAd, new BoardAdMsg { action = "remove", highlights = Array.Empty<BoardHighlight>() }), 100);
            }
            else
            {
                row.Title("Panoya ilan ver").Sub($"Elmasla ödenir, tezgah kapanınca ilan da kalkar. Elmasın: {Kit.Num(Diamond)}");
                row.Button("Reklam ver", "wood", () =>
                {
                    adPanel = !adPanel;
                    dirty = true;
                }, 100);
            }
            if (!adPanel) return;
            if (offered.Count == 0) v.Line("Öne çıkacak kalemi seçmezsen ilan tezgahın ilk kalemlerini gösterir.");
            else v.Line("Öne çıkacak en fazla 3 kalem seç (boş bırakırsan ilk kalemler):");
            for (var i = 0; i < offered.Count; i++)
            {
                var h = offered[i];
                var index = i;
                var on = highlightPick.Contains(i);
                var name = !string.IsNullOrEmpty(h.defId) ? FishingController.ItemName(h.defId) : DescribeOffered(h.instanceId);
                v.Row().Title(name).Button(on ? "Seçili" : "Seç", on ? "green" : "wood", () =>
                {
                    if (highlightPick.Contains(index)) highlightPick.Remove(index);
                    else if (highlightPick.Count < 3) highlightPick.Add(index);
                    dirty = true;
                }, 70);
            }
            v.Row().Title(MyAd ? "Öne çıkanları güncelle" : "İlanı ver").Button(MyAd ? "Güncelle" : "İlanı ver (elmas)", "green",
                () => net.Send(OpCode.BoardAd, new BoardAdMsg { action = "set", highlights = highlightPick.OrderBy(x => x).Select(x => offered[x]).ToArray() }), 140);
        }

        string DescribeOffered(string instanceId)
        {
            // The item left the bag for the stall; the last full list of my stall may still name it.
            var it = Viewing != null && Viewing.userId == net.UserId ? Viewing.items?.FirstOrDefault(x => x.item.instanceId == instanceId)?.item : null;
            return it != null ? ItemText.Short(it, prices()) : "Float'lı eşya";
        }

        void DrawBoard(PanelView v)
        {
            v.header.text = "İlanlar (eskiden yeniye)";
            if (Ads.Count == 0) v.Line("Panoda ilan yok.", 0, false);
            foreach (var a in Ads)
            {
                var id = a.userId;
                var top = a.top ?? Array.Empty<StallEntry>();
                var row = v.Row().Title(string.IsNullOrEmpty(a.title) ? $"{a.name} tezgahı" : $"\"{a.title}\"")
                    .Sub($"{a.name} tezgahı · {a.total} kalem   " + string.Join("   ", top.Select(e => $"{ItemText.Entry(e)} {Kit.Num(e.price)}")));
                if (top.Length > 0) row.Mark(top[0].defId, top[0].tier, top[0].count);
                row.Button("Yanına git", "green", a.userId == net.UserId ? (Action)null : () =>
                {
                    net.Send(OpCode.BoardGoto, new GotoFriendMsg { userId = id });
                    gotoAt = Time.time;
                }, 100);
            }
            DrawAdControls(v);
            v.footer.text = "İlan eşya miktarını ya da kalitesini değiştirmez. Alım ilanı yok.";
        }

        // ----- Bir tezgahın tam listesi -----

        void RedrawStall(PanelView v)
        {
            stallDirty = false;
            var s = Viewing;
            var mine = s.userId == net.UserId;
            v.window.title.text = $"{s.name} tezgahı";
            v.header.text = string.IsNullOrEmpty(s.title) ? s.name : $"\"{s.title}\"  ·  {s.name}";
            var coin = fishing.Bag?.coin ?? 0;
            v.headerRight.text = $"Coin'in: {Kit.Num(coin)}";
            v.ClearRows();
            v.ClearFooter();
            var p = prices();
            foreach (var li in s.items ?? Array.Empty<StallListItem>())
            {
                if (li.item == null) continue;
                var key = "i:" + li.item.instanceId;
                var id = li.item.instanceId;
                var row = v.Row().Mark(li.item.defId, li.item.tier).Title(FishingController.ItemName(li.item.defId)).Sub(ItemText.Long(li.item, p))
                    .Right($"{Kit.Num(li.price)} Coin");
                row.Button(armedBuy == key ? "Emin misin?" : "Satın al", "green", mine || coin < li.price ? (Action)null : () =>
                {
                    if (armedBuy == key) net.Send(OpCode.StallBuy, new StallBuyMsg { userId = s.userId, instanceId = id, defId = "", count = 0 });
                    else armedBuy = key;
                    stallDirty = true;
                }, 100);
            }
            foreach (var st in s.stacks ?? Array.Empty<StallOpenStack>())
            {
                if (!buyCount.TryGetValue(st.defId, out var n)) n = 1;
                n = Mathf.Clamp(n, 1, Mathf.Max(1, st.count));
                var def = st.defId;
                var max = st.count;
                var price = st.price;
                var total = (long)n * price;
                var key = $"s:{def}:{n}";
                var row = v.Row().Mark(def, "", st.count).Title(FishingController.ItemName(def)).Sub($"{st.count} adet · tanesi {Kit.Num(price)} Coin");
                void Count(int value)
                {
                    buyCount[def] = Mathf.Clamp(value, 1, Mathf.Max(1, max));
                    stallDirty = true;
                }
                row.Button("-", "wood", () => Count(n - 1), 22);
                row.Note(n.ToString());
                row.Button("+", "wood", () => Count(n + 1), 22);
                row.Button("max", "wood", () => Count(max), 40);
                row.Button(armedBuy == key ? "Emin misin?" : $"Al ({Kit.Num(total)})", "green", mine || coin < total ? (Action)null : () =>
                {
                    if (armedBuy == key) net.Send(OpCode.StallBuy, new StallBuyMsg { userId = s.userId, instanceId = "", defId = def, count = n });
                    else armedBuy = key;
                    stallDirty = true;
                }, 100);
            }
            if ((s.items?.Length ?? 0) + (s.stacks?.Length ?? 0) == 0) v.Line("Tezgah boş");
            v.footer.text = mine ? "Kendi tezgahın." : $"Coin {s.name}'e gider, çevrimdışı olsa da. Float'lı eşyada Float ve kondisyon yazar.";
            if (!mine)
            {
                v.FooterButton("Profil", "wood", () => OpenProfile?.Invoke(s.userId), 80);
                v.FooterButton("Fısılda", "wood", () => Whisper?.Invoke(s.userId, s.name, "stall"), 80);
                v.FooterButton("Arkadaş ekle", "green", () => AddFriend?.Invoke(s.userId, s.name), 110);
            }
            v.FooterSpace();
        }
    }
}
