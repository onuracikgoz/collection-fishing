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

        /// <summary>The "Tezgah kur" / my stall window.</summary>
        public bool Open { get; set; }
        /// <summary>The Pazar Panosu window.</summary>
        public bool BoardOpen { get; set; }
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

        // Stall setup (tezgah-kur): what goes on the stall, in order.
        sealed class Pick
        {
            public ItemInstance Item;
            public string DefId;
            public int Count;
            public int Price;
        }

        string title = "";
        readonly List<Pick> picks = new List<Pick>();
        /// <summary>The item in the dark panel: a pick being edited, or a bag entry not put yet.</summary>
        Pick editing;
        bool editingNew;
        // Buying (tezgah-tezgah).
        int selected;
        int buyCount = 1;
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
            Current = tab;
            if (tab == Tab.Board) BoardOpen = true;
            else Open = true;
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
            if (MyStall != null || hadStall) Dirty();
            boardDirty = true;
            hadStall = MyStall != null;
        }

        public void OnStallList(StallListMsg m)
        {
            var opening = Viewing == null || Viewing.userId != m.userId;
            Viewing = m;
            stallDirty = true;
            if (opening)
            {
                selected = 0;
                buyCount = 1;
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
                    Toasts.Show(Loc.T("market.stall_opened"));
                    picks.Clear();
                    editing = null;
                    break;
                case "recall":
                    var back = (r.returned?.items?.Length ?? 0) + (r.returned?.stacks?.Length ?? 0);
                    Toasts.Show(Loc.T(r.reason == "EXPIRED" ? "market.stall_expired" : "market.stall_recalled", ("count", back)));
                    break;
                case "buy":
                    var what = r.item != null && !string.IsNullOrEmpty(r.item.instanceId)
                        ? FishingController.ItemName(r.item.defId)
                        : $"{FishingController.ItemName(r.defId)} x{r.count}";
                    Toasts.Show(Loc.T("market.bought", ("item", what), ("amount", Kit.Num(r.paid))));
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
            boardDirty = true;
            dirty = true;
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
            Toasts.Show(Loc.T(r.action == "remove" ? "market.ad_removed" : "market.ad_set"));
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
            Toasts.Show(t.reason == "NOT_HERE" ? Loc.T("market.goto.not_here") : t.reason == "NO_SPOT" ? Loc.T("market.goto.no_spot") : t.reason == "RATE_LIMITED" ? Loc.T("common.wait_retry") : Loc.T("market.goto.failed", ("code", t.reason)), true);
            return true;
        }

        /// <summary>Own FISH_END: a dropped diamond moves the balance.</summary>
        public void OnFishEnd(FishEndMsg e)
        {
            if (e.diamond != null && e.diamond.gained > 0)
            {
                if (fishing.Bag != null) fishing.Bag.diamond = e.diamond.total;
                Toasts.Money(Loc.T("market.diamond_found", ("count", e.diamond.gained)));
            }
        }

        /// <summary>Notification 103: someone bought from my stall.</summary>
        public void OnSold(StallSoldNotice n)
        {
            var what = n.count > 1 ? $"{FishingController.ItemName(n.defId)} x{n.count}" : FishingController.ItemName(n.defId);
            Toasts.Money(Loc.T("market.sale", ("amount", Kit.Num(n.price - n.fee))), Loc.T("market.sale_detail", ("buyer", n.buyer), ("item", what)));
            fishing.RefreshBag();
        }

        /// <summary>Server reason codes: keys market.err.CODE (Locales/*.json).</summary>
        static string Reason(string r) => Loc.Reason("market", r);

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
                var head = string.IsNullOrEmpty(s.title) ? Loc.T("market.stall_of", ("name", s.name)) : $"\"{s.title}\" · {s.name}";
                var text = head;
                if (near && s.top != null && s.top.Length > 0)
                    text += "\n" + string.Join("\n", s.top.Select(e => $"{ItemText.Entry(e)}  {Kit.Num(e.price)}")) + (s.total > s.top.Length ? "\n" + Loc.T("market.more_items", ("count", s.total - s.top.Length)) : "");
                var content = new GUIContent(text);
                var w = Mathf.Max(MarkerStyle.CalcSize(content).x + 4f, 60f);
                var h = MarkerStyle.CalcHeight(content, w);
                var r = new Rect(at.x - w / 2f, at.y - h - 4f, w, h);
                if (UiRoot.Covers(Gui.ToScreen(r.center))) continue;
                Gui.Block(r);
                if (GUI.Button(r, content, MarkerStyle)) ViewStall(s.userId);
            }
        }

        // ---------- UI (uGUI after tezgah-kur, tezgah-tezgah, tezgah-pano) ----------

        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);
        const float AdPageSeconds = 8f;

        StallSetupView setup;
        StallListView list;
        BoardView board;
        bool dirty = true, stallDirty = true, boardDirty = true;
        readonly List<SlotView> bagSlots = new List<SlotView>();
        int adPage;
        float adPageAt;
        /// <summary>Tooltip shared by the windows (set by the world).</summary>
        public PopupView Popup { get; set; }

        public void Destroy()
        {
            if (setup != null) UnityEngine.Object.Destroy(setup.gameObject);
            if (list != null) UnityEngine.Object.Destroy(list.gameObject);
            if (board != null) UnityEngine.Object.Destroy(board.gameObject);
        }

        void Dirty()
        {
            dirty = true;
            stallDirty = true;
            boardDirty = true;
        }

        bool Ensure()
        {
            var ui = UiRoot.Get();
            if (setup == null && (setup = ui.Spawn<StallSetupView>("StallSetup")) != null) WireSetup(setup);
            if (list == null && (list = ui.Spawn<StallListView>("Stall")) != null) WireList(list);
            if (board == null && (board = ui.Spawn<BoardView>("Board")) != null) WireBoard(board);
            return setup != null && list != null && board != null;
        }

        int locVersion;

        public void Tick()
        {
            if (!Ensure()) return;
            if (locVersion != Loc.Version)
            {
                locVersion = Loc.Version; // language changed: redraw the texts
                dirty = stallDirty = boardDirty = true;
            }
            if (setup.window.Open != Open)
            {
                setup.window.Open = Open;
                dirty = true;
            }
            if (list.window.Open != (Viewing != null))
            {
                list.window.Open = Viewing != null;
                stallDirty = true;
            }
            if (board.window.Open != BoardOpen)
            {
                board.window.Open = BoardOpen;
                boardDirty = true;
            }
            if (BoardOpen && Ads.Count > board.cards.Length && Time.time - adPageAt > AdPageSeconds)
            {
                adPage++;
                boardDirty = true;
            }
            // A rebuild would drop the field being typed in; wait until it is left.
            if (UiRoot.Typing) return;
            if (Open && dirty) RedrawSetup();
            if (Viewing != null && stallDirty) RedrawList();
            if (BoardOpen && boardDirty) RedrawBoard();
        }

        void HoverTip(SlotView slot)
        {
            if (Popup == null) return;
            switch (slot.Data)
            {
                case ItemInstance it:
                    Popup.ShowTooltip(ItemText.Card(it, prices()));
                    break;
                case ItemStack st:
                    Popup.ShowTooltip(ItemText.Card(st));
                    break;
                case StallEntry e:
                    Popup.ShowTooltip(new PopupView.Card { title = FishingController.ItemName(e.defId), sub = e.tier, subColour = ItemText.TierColour(e.tier), rows = new[] { (Loc.T("common.price"), Loc.T("common.coin_amount", ("amount", Kit.Num(e.price))) + (string.IsNullOrEmpty(e.tier) ? Loc.T("market.per_unit") : "")), (Loc.T("common.count"), Kit.Num(Mathf.Max(1, e.count))) } });
                    break;
            }
        }

        void Hoverable(SlotView slot)
        {
            slot.Hovered = HoverTip;
            slot.Left = _ => Popup?.HideTooltip();
        }

        // ----- Tezgah kur -----

        void WireSetup(StallSetupView v)
        {
            v.window.Closed = Close;
            v.window.Open = false;
            v.title.onValueChanged.AddListener(t => title = t);
            for (var i = 0; i < v.stall.Length; i++)
            {
                var index = i;
                Hoverable(v.stall[i]);
                v.stall[i].Clicked = _ =>
                {
                    if (MyStall != null || index >= picks.Count) return;
                    editing = picks[index];
                    editingNew = false;
                    dirty = true;
                };
            }
            v.put.onClick.AddListener(PutEditing);
            v.takeBack.onClick.AddListener(() =>
            {
                if (editing != null && !editingNew) picks.Remove(editing);
                editing = null;
                dirty = true;
            });
            v.open.onClick.AddListener(OpenStall);
            v.recall.onClick.AddListener(() => net.Send(OpCode.StallRecall, new EmptyMsg()));
            v.board.onClick.AddListener(() =>
            {
                BoardOpen = true;
                boardDirty = true;
            });
        }

        void PutEditing()
        {
            if (editing == null || setup == null) return;
            editing.Price = int.TryParse(setup.price.text, out var price) ? price : 0;
            if (editing.DefId != null)
                editing.Count = Mathf.Clamp(int.TryParse(setup.count.text, out var n) ? n : 1, 1, Mathf.Max(1, fishing.StackCount(editing.DefId)));
            if (editing.Price <= 0)
            {
                Toasts.Show(Loc.T("market.need_price"), true);
                return;
            }
            if (editingNew)
            {
                if (picks.Count >= setup.stall.Length)
                {
                    Toasts.Show(Loc.T("market.stall_full"), true);
                    return;
                }
                picks.Add(editing);
            }
            editing = null;
            dirty = true;
        }

        void PickFromBag(object data)
        {
            if (MyStall != null) return;
            switch (data)
            {
                case ItemInstance it when !it.locked:
                    editing = picks.FirstOrDefault(x => x.Item == it) ?? new Pick { Item = it, Count = 1 };
                    break;
                case ItemStack st:
                    editing = picks.FirstOrDefault(x => x.DefId == st.defId) ?? new Pick { DefId = st.defId, Count = st.count };
                    break;
                default:
                    return;
            }
            editingNew = !picks.Contains(editing);
            dirty = true;
        }

        void RedrawSetup()
        {
            dirty = false;
            var v = setup;
            var mine = MyStall;
            var open = mine != null;
            v.window.title.text = Loc.T(open ? "market.my_stall" : "market.setup_title");
            v.title.interactable = !open;
            v.title.SetTextWithoutNotify(open ? mine.title : title);
            v.open.gameObject.SetActive(!open);
            v.recall.gameObject.SetActive(open);
            v.stallHint.text = !open ? ""
                : mine.expiresInMs >= 3600000 ? Loc.T("market.time_left_hours", ("hours", (mine.expiresInMs / 3600000f).ToString("0.#", Loc.Culture)))
                : Loc.T("market.time_left_minutes", ("minutes", mine.expiresInMs / 60000));
            v.bagHint.text = open ? Loc.T("market.bag_hint_open") : "";
            v.place.text = Loc.T("market.place", ("count", Stalls.Count));

            // Stall slots: my open stall's first entries, or the picks.
            if (open)
            {
                var top = mine.top ?? Array.Empty<StallEntry>();
                v.stallHeader.text = Loc.T("market.stall_header_total", ("count", mine.total));
                for (var i = 0; i < v.stall.Length; i++)
                {
                    var e = i < top.Length ? top[i] : null;
                    if (e == null) v.stall[i].SetEmpty();
                    else v.stall[i].SetItem(e.defId, e.tier, e.count, false);
                    v.stall[i].Data = e;
                    v.tags[i].Set(e?.price ?? 0);
                }
                v.picked.SetActive(false);
            }
            else
            {
                v.stallHeader.text = Loc.T("market.stall_header_picks", ("count", picks.Count), ("max", v.stall.Length));
                for (var i = 0; i < v.stall.Length; i++)
                {
                    var pk = i < picks.Count ? picks[i] : null;
                    if (pk == null) v.stall[i].SetEmpty();
                    else if (pk.Item != null) v.stall[i].SetItem(pk.Item, false, pk == editing);
                    else v.stall[i].SetItem(pk.DefId, "", pk.Count, false, pk == editing);
                    v.stall[i].Data = pk?.Item != null ? (object)pk.Item : pk != null ? new ItemStack { defId = pk.DefId, count = pk.Count } : null;
                    v.tags[i].Set(pk?.Price ?? 0);
                }
                v.picked.SetActive(editing != null);
                if (editing != null)
                {
                    var p = prices();
                    var stack = editing.DefId != null;
                    v.pickedName.text = stack ? FishingController.ItemName(editing.DefId) : $"{FishingController.ItemName(editing.Item.defId)} · {editing.Item.@float:0.0000}";
                    v.pickedCondition.text = stack ? Loc.T("common.in_bag", ("count", fishing.StackCount(editing.DefId))) : p != null ? Prices.ConditionName(p.ConditionOf(editing.Item.@float)) : editing.Item.tier;
                    v.countLabel.gameObject.SetActive(stack);
                    v.count.gameObject.SetActive(stack);
                    v.count.SetTextWithoutNotify(editing.Count.ToString());
                    v.price.SetTextWithoutNotify(editing.Price > 0 ? editing.Price.ToString() : "");
                    v.put.GetComponentInChildren<UnityEngine.UI.Text>().text = Loc.T(editingNew ? "market.put" : "market.update");
                    v.takeBack.GetComponentInChildren<UnityEngine.UI.Text>().text = Loc.T(editingNew ? "common.cancel" : "market.take_back");
                }
            }
            v.open.interactable = picks.Count > 0;

            // Bag: what can still go on the stall.
            var bag = fishing.Bag;
            var entries = new List<object>();
            if (bag != null && !open)
            {
                entries.AddRange((bag.items ?? Array.Empty<ItemInstance>()).Where(i => picks.All(x => x.Item != i)).OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId));
                entries.AddRange((bag.stacks ?? Array.Empty<ItemStack>()).Where(st => picks.All(x => x.DefId != st.defId)));
            }
            var cells = Mathf.Max(20, Mathf.CeilToInt(entries.Count / 10f) * 10);
            while (bagSlots.Count < cells)
            {
                var slot = UnityEngine.Object.Instantiate(v.bagTemplate, v.bagGrid, false);
                slot.gameObject.SetActive(true);
                Hoverable(slot);
                slot.Clicked = sv => PickFromBag(sv.Data);
                bagSlots.Add(slot);
            }
            for (var i = 0; i < bagSlots.Count; i++)
            {
                var slot = bagSlots[i];
                slot.gameObject.SetActive(i < cells);
                var e = i < entries.Count ? entries[i] : null;
                if (e is ItemInstance it) slot.SetItem(it, true);
                else if (e is ItemStack st) slot.SetItem(st.defId, "", st.count, false);
                else slot.SetEmpty();
                slot.Data = e;
            }
        }

        void OpenStall()
        {
            var items = picks.Where(x => x.Item != null).Select(x => new StallOpenItem { instanceId = x.Item.instanceId, price = x.Price }).ToArray();
            var stacks = picks.Where(x => x.DefId != null).Select(x => new StallOpenStack { defId = x.DefId, count = x.Count, price = x.Price }).ToArray();
            if (items.Length + stacks.Length == 0) return;
            net.Send(OpCode.StallOpen, new StallOpenMsg { title = (title ?? "").Trim(), items = items, stacks = stacks });
        }

        // ----- Bir tezgahın tam listesi -----

        void WireList(StallListView v)
        {
            v.window.Closed = () => Viewing = null;
            v.window.Open = false;
            for (var i = 0; i < v.slots.Length; i++)
            {
                var index = i;
                Hoverable(v.slots[i]);
                v.slots[i].Clicked = _ =>
                {
                    selected = index;
                    buyCount = 1;
                    armedBuy = null;
                    stallDirty = true;
                };
            }
            v.profile.onClick.AddListener(() => OpenProfile?.Invoke(Viewing?.userId));
            v.whisper.onClick.AddListener(() => Whisper?.Invoke(Viewing?.userId, Viewing?.name, "stall"));
            v.friend.onClick.AddListener(() => AddFriend?.Invoke(Viewing?.userId, Viewing?.name));
            v.minus.onClick.AddListener(() => SetBuyCount(buyCount - 1));
            v.plus.onClick.AddListener(() => SetBuyCount(buyCount + 1));
            v.max.onClick.AddListener(() => SetBuyCount(int.MaxValue));
            v.count.onEndEdit.AddListener(t => SetBuyCount(int.TryParse(t, out var n) ? n : 1));
            v.buy.onClick.AddListener(Buy);
        }

        List<object> ListEntries()
        {
            var e = new List<object>();
            if (Viewing == null) return e;
            e.AddRange((Viewing.items ?? Array.Empty<StallListItem>()).Where(x => x.item != null));
            e.AddRange(Viewing.stacks ?? Array.Empty<StallOpenStack>());
            return e;
        }

        void SetBuyCount(int n)
        {
            var entries = ListEntries();
            var max = selected < entries.Count && entries[selected] is StallOpenStack st ? st.count : 1;
            buyCount = Mathf.Clamp(n, 1, Mathf.Max(1, max));
            armedBuy = null;
            stallDirty = true;
        }

        void Buy()
        {
            var entries = ListEntries();
            if (Viewing == null || selected >= entries.Count) return;
            var key = $"{selected}:{buyCount}";
            if (armedBuy != key)
            {
                armedBuy = key;
                stallDirty = true;
                return;
            }
            if (entries[selected] is StallListItem li)
                net.Send(OpCode.StallBuy, new StallBuyMsg { userId = Viewing.userId, instanceId = li.item.instanceId, defId = "", count = 0 });
            else if (entries[selected] is StallOpenStack st)
                net.Send(OpCode.StallBuy, new StallBuyMsg { userId = Viewing.userId, instanceId = "", defId = st.defId, count = buyCount });
            armedBuy = null;
        }

        void RedrawList()
        {
            stallDirty = false;
            var v = list;
            var s = Viewing;
            var mine = s.userId == net.UserId;
            v.window.title.text = Loc.T("market.stall_of", ("name", s.name));
            v.title.text = string.IsNullOrEmpty(s.title) ? Loc.T("market.stall_of", ("name", s.name)) : $"\"{s.title}\"";
            v.owner.text = Loc.T("market.owner_line", ("name", s.name));
            v.pet.SetEmpty();
            v.profile.gameObject.SetActive(!mine);
            v.whisper.gameObject.SetActive(!mine);
            v.friend.gameObject.SetActive(!mine);
            var entries = ListEntries();
            if (selected >= entries.Count) selected = 0;
            for (var i = 0; i < v.slots.Length; i++)
            {
                var e = i < entries.Count ? entries[i] : null;
                var slot = v.slots[i];
                switch (e)
                {
                    case StallListItem li:
                        slot.SetItem(li.item, false, i == selected);
                        slot.Data = li.item;
                        v.tags[i].Set(li.price);
                        break;
                    case StallOpenStack st:
                        slot.SetItem(st.defId, "", st.count, false, i == selected);
                        slot.Data = new StallEntry { defId = st.defId, tier = "", count = st.count, price = st.price };
                        v.tags[i].Set(st.price);
                        break;
                    default:
                        slot.SetEmpty();
                        slot.Data = null;
                        v.tags[i].Set(0);
                        break;
                }
            }

            var coin = fishing.Bag?.coin ?? 0;
            v.detail.SetActive(entries.Count > 0);
            if (entries.Count > 0)
            {
                var p = prices();
                long unit, total;
                switch (entries[selected])
                {
                    case StallListItem li:
                        v.detailSlot.SetItem(li.item, false);
                        v.detailName.text = FishingController.ItemName(li.item.defId);
                        v.detailSub.text = $"{li.item.tier} · {(p != null ? Prices.ConditionName(p.ConditionOf(li.item.@float)) + " · " : "")}Float {li.item.@float:0.0000}";
                        v.countRow.SetActive(false);
                        unit = total = li.price;
                        break;
                    case StallOpenStack st:
                        v.detailSlot.SetItem(st.defId, "", st.count, false);
                        v.detailName.text = FishingController.ItemName(st.defId);
                        v.detailSub.text = Loc.T("market.pieces", ("count", st.count));
                        v.countRow.SetActive(true);
                        v.count.SetTextWithoutNotify(buyCount.ToString());
                        unit = st.price;
                        total = (long)st.price * buyCount;
                        break;
                    default:
                        unit = total = 0;
                        break;
                }
                v.unitPrice.text = Kit.Num(unit);
                v.total.text = Kit.Num(total);
                v.buy.interactable = !mine && coin >= total;
                v.buyText.text = Loc.T(mine ? "market.own_stall" : coin < total ? "err.NOT_ENOUGH_COIN" : armedBuy == $"{selected}:{buyCount}" ? "common.are_you_sure" : "market.buy");
            }
            v.footer.text = Loc.T("market.footer", ("count", entries.Count), ("name", s.name));
        }

        // ----- Pano -----

        void WireBoard(BoardView v)
        {
            v.window.Closed = () => BoardOpen = false;
            v.window.Open = false;
            for (var i = 0; i < v.cards.Length; i++)
            {
                var index = i;
                foreach (var slot in v.cards[i].slots) Hoverable(slot);
                v.cards[i].go.onClick.AddListener(() => GoTo(index));
            }
            v.advertise.onClick.AddListener(() =>
            {
                if (MyAd) net.Send(OpCode.BoardAd, new BoardAdMsg { action = "remove", highlights = Array.Empty<BoardHighlight>() });
                else net.Send(OpCode.BoardAd, new BoardAdMsg { action = "set", highlights = Array.Empty<BoardHighlight>() });
            });
        }

        int PageStart => Ads.Count <= board.cards.Length ? 0 : adPage * board.cards.Length % Ads.Count;

        void GoTo(int card)
        {
            var i = PageStart + card;
            if (i >= Ads.Count) return;
            var ad = Ads[i];
            if (ad.userId == net.UserId) return;
            net.Send(OpCode.BoardGoto, new GotoFriendMsg { userId = ad.userId });
            gotoAt = Time.time;
        }

        void RedrawBoard()
        {
            boardDirty = false;
            adPageAt = Time.time;
            var v = board;
            var start = PageStart;
            for (var i = 0; i < v.cards.Length; i++)
            {
                var c = v.cards[i];
                var ad = i < Ads.Count ? Ads[(start + i) % Ads.Count] : null;
                c.root.SetActive(ad != null);
                if (ad == null) continue;
                c.pet.SetEmpty();
                c.title.text = string.IsNullOrEmpty(ad.title) ? Loc.T("market.stall_of", ("name", ad.name)) : $"\"{ad.title}\"";
                c.owner.text = Loc.T("market.ad_owner", ("name", ad.name), ("count", ad.total));
                var top = ad.top ?? Array.Empty<StallEntry>();
                for (var j = 0; j < c.slots.Length; j++)
                {
                    var e = j < top.Length ? top[j] : null;
                    if (e == null) c.slots[j].SetEmpty();
                    else c.slots[j].SetItem(e.defId, e.tier, e.count, false);
                    c.slots[j].Data = e;
                    c.tags[j].Set(e?.price ?? 0);
                }
                c.go.interactable = ad.userId != net.UserId;
            }
            v.empty.gameObject.SetActive(Ads.Count == 0);
            v.advertise.interactable = MyStall != null;
            v.advertiseText.text = Loc.T(MyAd ? "market.remove_ad" : "market.advertise");
        }
    }
}
