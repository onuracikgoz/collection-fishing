using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine.UI;
using CollectionGame.World;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.Economy
{
    /// <summary>
    /// Faz 4 on the client (docs/protokol.md, Ekonomi / Birleştirme ve craft / Olta
    /// ve özel yem / Depo): one window with tabs for selling and salvaging, merging
    /// 3 copies into 1, crafting from recipes, the shop (rod repair, special bait)
    /// and the bank stash. Sends intents only (SELL, SALVAGE, MERGE, CRAFT,
    /// REPAIR_ROD, BUY_BAIT, STASH_*); balances, Float and every outcome come from
    /// the server. Prices shown before a click come from get_catalog. Placeholder UI.
    ///
    /// The windows open only next to their NPC (World/NpcController: E or a click);
    /// the stash also needs the server's bank range.
    /// </summary>
    public sealed class EconomyController
    {
        /// <summary>Sell, Salvage, Shop: Balıkçı Tüccar. Merge, Craft: Zanaatkar. Stash: Banka.</summary>
        public enum Tab { Sell, Merge, Craft, Shop, Stash, Salvage }

        const float ReplyTimeout = 3f;
        const float NoteSeconds = 4f;

        readonly Connection net;
        readonly FishingController fishing;
        readonly Func<Vector2?> myPosition;

        public bool Open { get; set; }
        public Tab Current { get; set; }
        public Prices Prices { get; private set; }
        public StashView Stash { get; private set; }
        /// <summary>A crafted or merged item with a book outcome, shaped like FISH_END for the book banners.</summary>
        public Action<FishEndMsg> Crafted { get; set; }

        public long Coin => fishing.Bag?.coin ?? 0;
        public long Dust => fishing.Bag?.dust ?? 0;

        // Sell / salvage selection.
        readonly HashSet<string> sellItems = new HashSet<string>();
        readonly Dictionary<string, int> sellStacks = new Dictionary<string, int>();
        bool confirmArmed;
        long confirmOp;
        // Merge.
        string mergeDefId;
        readonly HashSet<string> mergeItems = new HashSet<string>();
        // Craft.
        string recipeId;
        readonly HashSet<string> craftItems = new HashSet<string>();
        // Shop.
        readonly Dictionary<string, int> buyCounts = new Dictionary<string, int>();
        // Stash.
        readonly HashSet<string> putItems = new HashSet<string>();
        readonly Dictionary<string, int> putStacks = new Dictionary<string, int>();
        readonly HashSet<string> takeItems = new HashSet<string>();
        readonly Dictionary<string, int> takeStacks = new Dictionary<string, int>();
        bool stashRequested;

        float pendingSince = -1f;
        bool loadingCatalog;

        public EconomyController(Connection net, FishingController fishing, Func<Vector2?> myPosition)
        {
            this.net = net;
            this.fishing = fishing;
            this.myPosition = myPosition;
            fishing.BagChanged += PruneSelections;
            fishing.BagChanged += () => dirty = true;
        }

        /// <summary>Waiting for the server's answer to the last action: buttons stay off.</summary>
        public bool Pending => pendingSince >= 0f && Time.time - pendingSince < ReplyTimeout;

        // ---------- input ----------

        public void Update(bool typing)
        {
            // No keys of its own: the NPCs open these windows.
        }

        public bool MerchantOpen => Open && MerchantTab;
        public bool CrafterOpen => Open && CrafterTab;
        public bool BankOpen => Open && Current == Tab.Stash;

        /// <summary>Closes whichever NPC window is open.</summary>
        public void Hide() => Close();

        /// <summary>Joined a server: the catalog also places the bank marker.</summary>
        public void OnWelcome()
        {
            if (Prices == null) LoadCatalog();
        }

        public void Show(Tab tab)
        {
            Open = true;
            Current = tab;
            dirty = true;
            if (Prices == null) LoadCatalog();
            fishing.RefreshBag();
        }

        void Close()
        {
            Open = false;
            confirmArmed = false;
            stashRequested = false;
            GUIUtility.keyboardControl = 0;
        }

        async void LoadCatalog()
        {
            if (loadingCatalog) return;
            loadingCatalog = true;
            try
            {
                Prices = new Prices(await net.GetCatalogAsync());
            }
            catch (Exception ex)
            {
                ShowNote(Loc.T("economy.catalog_failed"), true);
                Debug.LogWarning($"[Economy] get_catalog failed: {ex.Message}");
            }
            loadingCatalog = false;
        }

        void Send(long op, object body)
        {
            net.Send(op, body);
            pendingSince = Time.time;
            confirmArmed = false;
        }

        // ---------- server messages ----------

        public void OnEconomyResult(EconomyResultMsg r)
        {
            pendingSince = -1f;
            dirty = true;
            Debug.Log($"[Economy] ECONOMY_RESULT {r.action} ok {r.ok} {r.reason} gained {r.gained} coin {r.coin} dust {r.dust}");
            SetBalances(r.coin, r.dust);
            if (!r.ok)
            {
                ShowNote(Reason(r.reason), true);
                return;
            }
            if (r.action == "sell") Toasts.Money(Loc.T("economy.sold", ("amount", r.gained)));
            else Toasts.Money(Loc.T("economy.salvaged", ("amount", r.gained)));
            sellItems.Clear();
            sellStacks.Clear();
            fishing.RefreshBag();
        }

        public void OnCraftResult(CraftResultMsg r)
        {
            pendingSince = -1f;
            dirty = true;
            Debug.Log($"[Economy] CRAFT_RESULT {r.action} ok {r.ok} {r.reason} dust {r.dust}");
            if (fishing.Bag != null) fishing.Bag.dust = r.dust;
            if (!r.ok)
            {
                ShowNote(Reason(r.reason), true);
                return;
            }
            var hasItem = r.item != null && !string.IsNullOrEmpty(r.item.instanceId);
            if (hasItem)
            {
                var cond = Prices != null ? Prices.ConditionOf(r.item.@float) : "";
                ShowNote(Loc.T(r.action == "merge" ? "economy.merged_item" : "economy.crafted_item", ("item", FishingController.ItemName(r.item.defId)), ("tier", r.item.tier),
                    ("condition", Prices.ConditionName(cond)), ("float", r.item.@float.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture))), false);
                // The book banners and "Defterdekiyle değiştir?" work off FISH_END's shape.
                if (r.book != null && !string.IsNullOrEmpty(r.book.page))
                    Crafted?.Invoke(new FishEndMsg { id = net.UserId, outcome = FishOutcome.Caught, defId = r.item.defId, item = r.item, book = r.book });
            }
            else if (r.stack != null && !string.IsNullOrEmpty(r.stack.defId))
            {
                ShowNote(Loc.T("economy.crafted_stack", ("item", FishingController.ItemName(r.stack.defId)), ("count", r.stack.count)), false);
            }
            if (r.action == "merge") mergeItems.Clear();
            else craftItems.Clear();
            fishing.RefreshBag();
        }

        public void OnShopResult(ShopResultMsg r)
        {
            pendingSince = -1f;
            dirty = true;
            Debug.Log($"[Economy] SHOP_RESULT {r.action} ok {r.ok} {r.reason} spent {r.spent} coin {r.coin}");
            if (fishing.Bag != null) fishing.Bag.coin = r.coin;
            if (!r.ok)
            {
                ShowNote(Reason(r.reason), true);
                return;
            }
            if (r.action == "repair")
            {
                fishing.SetRod(r.rod);
                ShowNote(Loc.T("economy.repaired", ("durability", r.rod?.durability), ("max", r.rod?.max), ("spent", r.spent)), false);
            }
            else
            {
                if (r.stack != null) fishing.SetStack(r.stack.defId, r.stack.count);
                ShowNote(Loc.T("economy.bought", ("item", FishingController.ItemName(r.stack?.defId)), ("count", r.stack?.count), ("spent", r.spent)), false);
                fishing.RefreshBag(); // slot count
            }
        }

        public void OnStashResult(StashResultMsg r)
        {
            pendingSince = -1f;
            dirty = true;
            Debug.Log($"[Economy] STASH_RESULT {r.action} ok {r.ok} {r.reason}");
            if (!r.ok)
            {
                if (r.reason == "NOT_AT_BANK") Stash = null;
                ShowNote(Reason(r.reason), true);
                return;
            }
            if (r.stash != null && r.stash.slotsMax > 0) Stash = r.stash;
            switch (r.action)
            {
                case "put":
                    ShowNote(Loc.T("economy.stash_put"), false);
                    putItems.Clear();
                    putStacks.Clear();
                    fishing.RefreshBag();
                    break;
                case "take":
                    ShowNote(Loc.T("economy.stash_take"), false);
                    takeItems.Clear();
                    takeStacks.Clear();
                    fishing.RefreshBag();
                    break;
                case "expand":
                    if (fishing.Bag != null) fishing.Bag.coin = r.coin;
                    ShowNote(Loc.T("economy.stash_expanded", ("slots", Stash?.slotsMax)), false);
                    break;
            }
        }

        void SetBalances(long coin, long dust)
        {
            if (fishing.Bag == null) return;
            fishing.Bag.coin = coin;
            fishing.Bag.dust = dust;
        }

        /// <summary>Drops picks that left the bag (sold, caught by a refresh, used elsewhere).</summary>
        void PruneSelections()
        {
            var ids = new HashSet<string>((fishing.Bag?.items ?? Array.Empty<ItemInstance>()).Select(i => i.instanceId));
            sellItems.IntersectWith(ids);
            mergeItems.IntersectWith(ids);
            craftItems.IntersectWith(ids);
            putItems.IntersectWith(ids);
            Clamp(sellStacks);
            Clamp(putStacks);
            // Ready for the next one with the same picks rule.
            if (Prices != null && recipeId != null && craftItems.Count == 0)
            {
                var rec = Prices.Recipe(recipeId);
                if (rec != null) PreselectCraftItems(rec);
            }
            if (mergeDefId != null && mergeItems.Count == 0) PreselectMerge(Prices?.Catalog.mergeCount ?? 3);
        }

        void PreselectMerge(int need)
        {
            var copies = BagItems.Where(i => i.defId == mergeDefId).ToList();
            if (copies.Count < need) return;
            // Worst copies first: the clean ones stay for the book or the market.
            foreach (var it in copies.OrderByDescending(i => i.@float).Take(need)) mergeItems.Add(it.instanceId);
        }

        void Clamp(Dictionary<string, int> picks)
        {
            foreach (var d in picks.Keys.ToList())
            {
                var n = Mathf.Min(picks[d], fishing.StackCount(d));
                if (n > 0) picks[d] = n;
                else picks.Remove(d);
            }
        }

        /// <summary>Server reason codes: keys economy.err.CODE (Locales/*.json).</summary>
        static string Reason(string reason) => Loc.Reason("economy", reason);

        void ShowNote(string text, bool bad) => Toasts.Show(text, bad);

        // ---------- map ----------

        /// <summary>Marks the bank on the map (the stash only opens there). Call from OnGUI.</summary>
        public void DrawMarkers(Camera cam)
        {
            var bank = Prices?.Catalog.stash;
            if (cam == null || bank == null || bank.range <= 0) return;
            var at = Gui.ToGui(cam.WorldToScreenPoint(Coords.ToUnity(new Vector2(bank.x, bank.y))));
            var label = Loc.T("economy.bank_label");
            var size = Gui.Name.CalcSize(new GUIContent(label)) + new Vector2(6f, 4f);
            var r = new Rect(at.x - size.x / 2f, at.y - size.y, size.x, size.y);
            GUI.Label(new Rect(r.x + 1, r.y + 1, r.width, r.height), label, Gui.Shadow);
            GUI.Label(r, label, Gui.NameMe);
        }

        float? BankDistance()
        {
            var bank = Prices?.Catalog.stash;
            var me = myPosition();
            if (bank == null || !me.HasValue) return null;
            return Vector2.Distance(me.Value, new Vector2(bank.x, bank.y));
        }

        // ---------- UI (uGUI: Merchant, Crafter, Bank after npc-sat/parcala, npc-craft/birlestir, npc-depo) ----------

        static readonly Color Ink = new Color32(0x45, 0x29, 0x3f, 255);
        static readonly Color Paper = new Color32(0xf2, 0xe8, 0xd0, 255);
        static readonly Color Good = new Color32(0x1e, 0x6f, 0x50, 255);
        static readonly Color Bad = new Color32(0xe8, 0x3b, 0x3b, 255);
        static readonly Color Gold = new Color32(0xf9, 0xc2, 0x2b, 255);
        static readonly Color DustBlue = new Color32(0x8f, 0xd3, 0xff, 255);

        MerchantView merchant;
        CrafterView crafter;
        BankView bank;
        bool dirty = true;
        readonly List<SlotView> merchantSlots = new List<SlotView>(), mergeSlots = new List<SlotView>(), stashSlots = new List<SlotView>(), bankBagSlots = new List<SlotView>();
        public PopupView Popup { get; set; }

        bool MerchantTab => Current == Tab.Sell || Current == Tab.Salvage || Current == Tab.Shop;
        bool CrafterTab => Current == Tab.Merge || Current == Tab.Craft;
        bool NearBank
        {
            get
            {
                var bankPoint = Prices?.Catalog.stash;
                var d = BankDistance();
                return bankPoint != null && d.HasValue && d.Value <= bankPoint.range;
            }
        }

        public void Destroy()
        {
            if (merchant != null) UnityEngine.Object.Destroy(merchant.gameObject);
            if (crafter != null) UnityEngine.Object.Destroy(crafter.gameObject);
            if (bank != null) UnityEngine.Object.Destroy(bank.gameObject);
        }

        /// <summary>Old IMGUI hook: nothing left to draw (notes are toasts now).</summary>
        public void DrawGui() { }

        bool Ensure()
        {
            var ui = UiRoot.Get();
            if (merchant == null && (merchant = ui.Spawn<MerchantView>("Merchant")) != null) WireMerchant(merchant);
            if (crafter == null && (crafter = ui.Spawn<CrafterView>("Crafter")) != null) WireCrafter(crafter);
            if (bank == null && (bank = ui.Spawn<BankView>("Bank")) != null) WireBank(bank);
            return merchant != null && crafter != null && bank != null;
        }

        int locVersion;

        public void Tick()
        {
            if (!Ensure()) return;
            if (locVersion != Loc.Version)
            {
                locVersion = Loc.Version; // language changed: redraw the texts
                dirty = true;
            }
            if (Open && Current == Tab.Stash && !NearBank && Prices != null)
            {
                // Walked away from the bank.
                Stash = null;
                stashRequested = false;
                Close();
            }
            Follow(merchant.window, Open && MerchantTab);
            Follow(crafter.window, Open && CrafterTab);
            Follow(bank.window, Open && Current == Tab.Stash);
            if (!Open || UiRoot.Typing || !dirty) return;
            dirty = false;
            if (Prices == null || fishing.Bag == null) return;
            if (MerchantTab) RedrawMerchant();
            else if (CrafterTab) RedrawCrafter();
            else RedrawBank();
        }

        void Follow(WindowView w, bool open)
        {
            if (w.Open == open) return;
            w.Open = open;
            dirty = true;
        }

        void Select(Tab tab)
        {
            Current = tab;
            confirmArmed = false;
            dirty = true;
        }

        ItemInstance[] BagItems => fishing.Bag?.items ?? Array.Empty<ItemInstance>();
        ItemStack[] BagStacks => fishing.Bag?.stacks ?? Array.Empty<ItemStack>();

        void Tip(SlotView s)
        {
            if (Popup == null || s.Data == null) return;
            switch (s.Data)
            {
                case ItemInstance it:
                    Popup.ShowTooltip(Current == Tab.Salvage
                        ? ItemText.Card(it, Prices, Loc.T("economy.salvage_note"), (Loc.T("common.dust"), Kit.Num(Prices.DustOf(it))))
                        : ItemText.Card(it, Prices, null, (Loc.T("common.price"), Loc.T("common.coin_amount", ("amount", Kit.Num(Prices.SellPrice(it)))))));
                    break;
                case ItemStack st:
                    Popup.ShowTooltip(ItemText.Card(st));
                    break;
            }
        }

        /// <summary>Fills a grid with entries (ItemInstance / ItemStack), at least min cells, a row of cols at a time.</summary>
        /// <summary>A grid laid out by a SlotOrder: what sits where now, for drag and drop.</summary>
        sealed class Laid
        {
            public SlotOrder Order;
            public object[] Grid = Array.Empty<object>();
            public Action<SlotView> Across;
        }

        readonly Dictionary<List<SlotView>, Laid> laidGrids = new Dictionary<List<SlotView>, Laid>();

        /// <summary>
        /// Fills a slot grid. With an order, things keep the place the player dragged them to (bank:
        /// stash and bag, 31.10.2026 Onur); dropping onto the other grid of the window does what a click
        /// does there (across: take / put).
        /// </summary>
        void FillGrid(SlotGrid grid, List<SlotView> cells, List<object> entries, int min, int cols, Action<SlotView> click,
            Func<object, bool> selected = null, SlotOrder order = null, Action<SlotView> across = null)
        {
            var count = Mathf.CeilToInt(Mathf.Max(min, entries.Count) / (float)cols) * cols;
            object[] laid = entries.ToArray();
            if (order != null)
            {
                laid = order.Lay(entries, count);
                count = Mathf.CeilToInt(laid.Length / (float)cols) * cols;
                laidGrids[cells] = new Laid { Order = order, Grid = laid, Across = across };
            }
            while (cells.Count < count)
            {
                var s = UnityEngine.Object.Instantiate(grid.template, grid.content, false);
                s.gameObject.SetActive(true);
                s.Hovered = Tip;
                s.Left = _ => Popup?.HideTooltip();
                var list = cells;
                s.DragBegan = (c, e) => BeginDrag(list, c, e);
                s.Dragged = (c, e) => MoveDrag(e);
                s.Dropped = (c, e) => Drop(list, c, e);
                cells.Add(s);
            }
            for (var i = 0; i < cells.Count; i++)
            {
                var s = cells[i];
                s.gameObject.SetActive(i < count);
                s.Clicked = click;
                var e = i < laid.Length ? laid[i] : null;
                var on = e != null && selected != null && selected(e);
                if (e is ItemInstance it) s.SetItem(it.defId, it.tier, 1, it.locked, on);
                else if (e is ItemStack st) s.SetItem(st.defId, "", st.count, false, on);
                else s.SetEmpty();
                s.Data = e;
            }
        }

        SlotView ghost;

        void BeginDrag(List<SlotView> cells, SlotView s, UnityEngine.EventSystems.PointerEventData e)
        {
            if (s.Data == null || !laidGrids.ContainsKey(cells)) return;
            Popup?.HideTooltip();
            ghost = UnityEngine.Object.Instantiate(s, UiRoot.Get().transform, false);
            ghost.name = "DragGhost";
            var group = ghost.gameObject.AddComponent<CanvasGroup>();
            group.blocksRaycasts = false;
            group.alpha = 0.85f;
            ghost.transform.SetAsLastSibling();
            MoveDrag(e);
        }

        void MoveDrag(UnityEngine.EventSystems.PointerEventData e)
        {
            if (ghost == null) return;
            var rt = (RectTransform)ghost.transform;
            rt.anchorMin = rt.anchorMax = Vector2.zero;
            rt.pivot = new Vector2(0.5f, 0.5f);
            RectTransformUtility.ScreenPointToLocalPointInRectangle(UiRoot.Get().Rect, e.position, null, out var local);
            rt.anchoredPosition = local - UiRoot.Get().Rect.rect.min;
        }

        void Drop(List<SlotView> cells, SlotView s, UnityEngine.EventSystems.PointerEventData e)
        {
            if (ghost == null) return;
            UnityEngine.Object.Destroy(ghost.gameObject);
            ghost = null;
            if (!laidGrids.TryGetValue(cells, out var mine)) return;
            foreach (var kv in laidGrids)
            {
                var target = kv.Key.FirstOrDefault(t => t.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint((RectTransform)t.transform, e.position, null));
                if (target == null) continue;
                if (kv.Key == cells)
                {
                    if (target == s) return;
                    mine.Order.Swap(mine.Grid, cells.IndexOf(s), cells.IndexOf(target));
                    dirty = true;
                }
                else mine.Across?.Invoke(s);
                return;
            }
        }

        static List<object> Entries(IEnumerable<ItemInstance> items, IEnumerable<ItemStack> stacks)
        {
            var list = new List<object>();
            list.AddRange(items.OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId).ThenBy(i => i.@float));
            list.AddRange(stacks);
            return list;
        }

        // ----- Balıkçı Tüccar -----

        void WireMerchant(MerchantView v)
        {
            v.window.Closed = Close;
            v.window.Open = false;
            Tab[] tabs = { Tab.Sell, Tab.Salvage, Tab.Shop };
            for (var i = 0; i < v.tabs.Length; i++)
            {
                var index = i;
                v.tabs[i].button.onClick.AddListener(() => Select(tabs[index]));
            }
            for (var i = 0; i < v.lines.Length; i++)
            {
                var index = i;
                v.lines[i].hover.Clicked = () => RemoveLine(index);
            }
            v.sellButton.onClick.AddListener(() => SellOrSalvage(OpCode.Sell));
            v.salvageButton.onClick.AddListener(() => SellOrSalvage(OpCode.Salvage));
            v.repair.onClick.AddListener(() => Send(OpCode.RepairRod, new EmptyMsg()));
            for (var i = 0; i < v.baits.Length; i++)
            {
                var index = i;
                var b = v.baits[i];
                b.minus.onClick.AddListener(() => BaitCount(index, -1));
                b.plus.onClick.AddListener(() => BaitCount(index, 1));
                b.buy.onClick.AddListener(() =>
                {
                    var bait = Bait(index);
                    if (bait != null) Send(OpCode.BuyBait, new BuyBaitMsg { defId = bait.defId, count = BuyCount(bait) });
                });
                b.use.onClick.AddListener(() =>
                {
                    var bait = Bait(index);
                    if (bait == null) return;
                    fishing.SelectedBait = fishing.SelectedBait == bait.defId ? null : bait.defId;
                    dirty = true;
                });
            }
        }

        CatalogBait Bait(int i)
        {
            var baits = Prices?.Catalog.baits ?? Array.Empty<CatalogBait>();
            return i < baits.Length ? baits[i] : null;
        }

        int BuyCount(CatalogBait b) => buyCounts.TryGetValue(b.defId, out var n) ? n : 5;

        void BaitCount(int i, int step)
        {
            var b = Bait(i);
            if (b == null) return;
            var max = Prices.Catalog.maxBuy > 0 ? Prices.Catalog.maxBuy : 99;
            buyCounts[b.defId] = Mathf.Clamp(BuyCount(b) + step, 1, max);
            dirty = true;
        }

        /// <summary>The basket in order: items, then stacks.</summary>
        List<object> Basket()
        {
            var list = new List<object>();
            list.AddRange(BagItems.Where(i => sellItems.Contains(i.instanceId)));
            list.AddRange(sellStacks.Where(p => p.Value > 0).Select(p => (object)new ItemStack { defId = p.Key, count = p.Value }));
            return list;
        }

        void ToggleBasket(SlotView s)
        {
            switch (s.Data)
            {
                case ItemInstance it when !it.locked:
                    if (!sellItems.Remove(it.instanceId)) sellItems.Add(it.instanceId);
                    break;
                case ItemStack st:
                    sellStacks.TryGetValue(st.defId, out var n);
                    sellStacks[st.defId] = n >= st.count ? 0 : st.count; // a click puts the whole stack in, the next takes it out
                    if (sellStacks[st.defId] == 0) sellStacks.Remove(st.defId);
                    break;
                default:
                    return;
            }
            confirmArmed = false;
            dirty = true;
        }

        void RemoveLine(int index)
        {
            var basket = Basket();
            if (index >= basket.Count) return;
            if (basket[index] is ItemInstance it) sellItems.Remove(it.instanceId);
            else if (basket[index] is ItemStack st) sellStacks.Remove(st.defId);
            confirmArmed = false;
            dirty = true;
        }

        long ValueOf(object e, bool salvage) => e switch
        {
            ItemInstance it => salvage ? Prices.DustOf(it) : Prices.SellPrice(it),
            ItemStack st => (long)(salvage ? Prices.DustOf(st.defId) : Prices.SellPrice(st.defId)) * st.count,
            _ => 0,
        };

        void SellOrSalvage(long op)
        {
            var items = BagItems.Where(i => sellItems.Contains(i.instanceId)).ToList();
            var stacks = sellStacks.Where(p => p.Value > 0).ToList();
            if (items.Count + stacks.Count == 0) return;
            // Rare and up, a clean copy or a recipe needs a second click: selling is final.
            var precious = items.Any(i => Tiers.Rank(i.tier) >= Tiers.Rank(Tiers.Rare) || Prices.ConditionOf(i.@float) == "pristine")
                || stacks.Any(p => Prices.Stack(p.Key)?.category == "recipe");
            if (!Act(op, precious))
            {
                dirty = true;
                return;
            }
            Send(op, SellBody(items, stacks));
            dirty = true;
        }

        void RedrawMerchant()
        {
            var v = merchant;
            var salvage = Current == Tab.Salvage;
            var shop = Current == Tab.Shop;
            var selectedTab = shop ? 2 : salvage ? 1 : 0;
            for (var i = 0; i < v.tabs.Length; i++) v.tabs[i].Set(i == selectedTab);
            v.coin.text = Kit.Num(Coin);
            v.dust.text = Kit.Num(Dust);
            v.sell.SetActive(!shop);
            v.shop.SetActive(shop);
            if (shop)
            {
                RedrawShop(v);
                return;
            }

            FillGrid(v.bag, merchantSlots, Entries(BagItems, BagStacks), 40, 8, ToggleBasket,
                e => e is ItemInstance it ? sellItems.Contains(it.instanceId) : e is ItemStack st && sellStacks.ContainsKey(st.defId));
            var basket = Basket();
            v.basketTitle.text = Loc.T("economy.basket_title", ("count", basket.Count));
            for (var i = 0; i < v.lines.Length; i++)
            {
                var line = v.lines[i];
                var e = i < basket.Count ? basket[i] : null;
                line.root.SetActive(e != null);
                if (e == null) continue;
                var value = ValueOf(e, salvage);
                if (e is ItemInstance it)
                {
                    line.icon.SetItem(it.defId, it.tier, 1, false);
                    line.name.text = $"{FishingController.ItemName(it.defId)}{(salvage ? "" : $" · {Prices.ConditionName(Prices.ConditionOf(it.@float))}")}";
                }
                else if (e is ItemStack st)
                {
                    line.icon.SetItem(st.defId, "", 1, false);
                    line.name.text = $"{FishingController.ItemName(st.defId)} × {st.count}";
                }
                line.value.text = value > 0 ? Kit.Num(value) : "—";
                line.valueIcon.color = salvage ? DustBlue : Gold;
            }
            v.more.text = basket.Count > v.lines.Length ? Loc.T("economy.basket_more", ("count", basket.Count - v.lines.Length)) : "";
            var total = basket.Sum(e => ValueOf(e, salvage));
            v.totalValue.text = Kit.Num(total);
            v.totalIcon.color = salvage ? DustBlue : Gold;
            var canAll = basket.Count > 0 && basket.All(e => ValueOf(e, salvage) > 0);
            var max = Prices.Catalog.maxEntries > 0 ? Prices.Catalog.maxEntries : 40;
            v.note.text = basket.Count == 0 ? Loc.T("economy.basket_hint")
                : basket.Count > max ? Loc.T("economy.basket_max", ("max", max))
                : !canAll ? Loc.T(salvage ? "economy.basket_cannot_salvage" : "economy.basket_cannot_sell")
                : Loc.T(salvage ? "economy.salvage_footer" : "economy.sell_footer");
            v.sellButton.gameObject.SetActive(!salvage);
            v.salvageButton.gameObject.SetActive(salvage);
            var enabled = !Pending && canAll && basket.Count <= max;
            v.sellButton.interactable = v.salvageButton.interactable = enabled;
            v.sellText.text = Loc.T(Armed(OpCode.Sell) ? "common.are_you_sure" : "economy.sell");
            v.salvageText.text = Loc.T(Armed(OpCode.Salvage) ? "common.are_you_sure" : "economy.salvage");
            v.bagHint.text = Loc.T("economy.bag_hint");
        }

        void RedrawShop(MerchantView v)
        {
            var rod = fishing.Rod;
            if (rod == null || rod.max <= 0)
            {
                v.rodText.text = Loc.T("economy.rod_unknown");
                HudView.Fill(v.rodFill, 0f);
                v.repair.interactable = false;
            }
            else
            {
                v.rodText.text = Loc.T("economy.rod_status", ("level", rod.level), ("durability", rod.durability), ("max", rod.max)) + (fishing.RodBroken ? Loc.T("economy.rod_broken") : "");
                HudView.Fill(v.rodFill, (float)rod.durability / rod.max);
                var cost = Prices.RepairCost(rod);
                v.repair.interactable = !Pending && cost > 0 && Coin > 0;
                v.repairText.text = cost == 0 ? Loc.T("economy.no_repair") : Loc.T("economy.repair", ("amount", Kit.Num(Math.Min(cost, Coin))));
            }
            for (var i = 0; i < v.baits.Length; i++)
            {
                var row = v.baits[i];
                var b = Bait(i);
                row.root.SetActive(b != null);
                if (b == null) continue;
                var n = BuyCount(b);
                row.icon.SetItem(b.defId, "", fishing.StackCount(b.defId), false);
                row.name.text = FishingController.ItemName(b.defId);
                row.info.text = Loc.T("economy.bait_info", ("price", b.price), ("count", fishing.StackCount(b.defId)));
                row.count.text = n.ToString();
                row.buy.interactable = !Pending && Coin >= (long)n * b.price;
                row.buyText.text = Loc.T("economy.buy", ("amount", Kit.Num((long)n * b.price)));
                row.use.interactable = fishing.StackCount(b.defId) > 0;
                row.useText.text = Loc.T(fishing.SelectedBait == b.defId ? "economy.bait_in_use" : "economy.bait_use");
            }
        }

        // ----- Zanaatkar -----

        void WireCrafter(CrafterView v)
        {
            v.window.Closed = Close;
            v.window.Open = false;
            v.tabs[0].button.onClick.AddListener(() => Select(Tab.Craft));
            v.tabs[1].button.onClick.AddListener(() => Select(Tab.Merge));
            for (var i = 0; i < v.recipes.Length; i++)
            {
                var index = i;
                v.recipes[i].button.onClick.AddListener(() =>
                {
                    var owned = OwnedRecipes();
                    if (index >= owned.Count) return;
                    recipeId = owned[index].id;
                    craftItems.Clear();
                    PreselectCraftItems(owned[index]);
                    dirty = true;
                });
            }
            v.craftButton.onClick.AddListener(() =>
            {
                var rec = OwnedRecipes().FirstOrDefault(r => r.id == recipeId);
                if (rec == null) return;
                var picked = BagItems.Where(i => craftItems.Contains(i.instanceId)).Select(i => i.instanceId).ToArray();
                Send(OpCode.Craft, new CraftMsg { recipeId = rec.id, items = picked });
                dirty = true;
            });
            v.mergeButton.onClick.AddListener(() =>
            {
                var picked = BagItems.Where(i => mergeItems.Contains(i.instanceId)).Select(i => i.instanceId).ToArray();
                Send(OpCode.Merge, new MergeMsg { items = picked });
                dirty = true;
            });
        }

        List<CatalogRecipe> OwnedRecipes() => (Prices?.Catalog.recipes ?? Array.Empty<CatalogRecipe>()).Where(r => fishing.StackCount(r.id) > 0).ToList();

        void RedrawCrafter()
        {
            var v = crafter;
            var merge = Current == Tab.Merge;
            for (var i = 0; i < v.tabs.Length; i++) v.tabs[i].Set(i == (merge ? 1 : 0));
            v.dust.text = Kit.Num(Dust);
            v.craft.SetActive(!merge);
            v.merge.SetActive(merge);
            if (merge) RedrawMerge(v);
            else RedrawCraft(v);
        }

        void RedrawCraft(CrafterView v)
        {
            var owned = OwnedRecipes();
            if (recipeId == null && owned.Count > 0)
            {
                recipeId = owned[0].id;
                PreselectCraftItems(owned[0]);
            }
            v.noRecipe.gameObject.SetActive(owned.Count == 0);
            for (var i = 0; i < v.recipes.Length; i++)
            {
                var c = v.recipes[i];
                var rec = i < owned.Count ? owned[i] : null;
                c.root.SetActive(rec != null);
                if (rec == null) continue;
                var on = rec.id == recipeId;
                c.back.sprite = on ? v.cardOn : v.cardOff;
                c.name.text = $"{OutputName(rec)} × {fishing.StackCount(rec.id)}";
                c.name.color = on ? Paper : Ink;
                c.grade.text = Prices.GradeName(rec.grade);
                c.grade.color = on ? Gold : Ink;
            }
            var recipe = owned.FirstOrDefault(r => r.id == recipeId);
            v.detail.SetActive(recipe != null);
            if (recipe == null) return;
            v.recipeName.text = recipe.output.count > 0 ? $"{OutputName(recipe)} × {recipe.output.count}" : OutputName(recipe);
            var gradeNote = Prices.GradeNote(recipe.grade);
            v.recipeSub.text = Loc.T("craft.recipe_sub", ("grade", Prices.GradeName(recipe.grade))) + (gradeNote.Length > 0 ? $" · {gradeNote}" : "");
            var ready = true;
            var missing = new List<string>();
            var picked = new List<ItemInstance>();
            var needs = new List<(string defId, string text, bool ok)>();
            foreach (var st in recipe.stacks ?? Array.Empty<ItemStack>())
            {
                var have = fishing.StackCount(st.defId);
                var ok = have >= st.count;
                ready &= ok;
                if (!ok) missing.Add(FishingController.ItemName(st.defId));
                needs.Add((st.defId, $"{have} / {st.count}", ok));
            }
            foreach (var need in recipe.items ?? Array.Empty<ItemStack>())
            {
                var chosen = BagItems.Where(i => i.defId == need.defId && craftItems.Contains(i.instanceId)).ToList();
                var ok = chosen.Count == need.count;
                ready &= ok;
                if (!ok) missing.Add(FishingController.ItemName(need.defId));
                picked.AddRange(chosen);
                needs.Add((need.defId, $"{chosen.Count} / {need.count}{(chosen.Count > 0 ? $" · Float {chosen.Max(x => x.@float):0.000}" : "")}", ok));
            }
            for (var i = 0; i < v.needs.Length; i++)
            {
                var n = v.needs[i];
                var e = i < needs.Count ? needs[i] : default;
                n.root.SetActive(i < needs.Count);
                if (i >= needs.Count) continue;
                n.icon.SetItem(e.defId, "", 1, false);
                n.name.text = FishingController.ItemName(e.defId);
                n.have.text = e.text;
                n.have.color = e.ok ? Good : Bad;
            }
            v.recipeDust.text = Loc.T("craft.dust_line", ("dust", recipe.dust), ("have", Kit.Num(Dust)));
            v.recipeDust.supportRichText = true;
            if (Dust < recipe.dust)
            {
                ready = false;
                missing.Add(Loc.T("craft.missing_dust"));
            }
            if (recipe.output.count == 0)
            {
                float? avg = picked.Count > 0 ? picked.Average(i => i.@float) : (float?)null;
                v.quality.text = Prices.QualityWord(avg);
                HudView.Fill(v.qualityFill, avg.HasValue ? 1f - Mathf.Clamp01(avg.Value) : 0.5f);
            }
            else
            {
                v.quality.text = "";
                HudView.Fill(v.qualityFill, 0f);
            }
            v.missing.text = missing.Count > 0 ? Loc.T("craft.missing", ("list", string.Join(", ", missing))) : "";
            v.craftButton.interactable = !Pending && ready;
            v.craftText.text = Loc.T("craft.craft");
        }

        void PickForMerge(SlotView s)
        {
            if (!(s.Data is ItemInstance it) || it.locked) return;
            var need = Prices.Catalog.mergeCount > 0 ? Prices.Catalog.mergeCount : 3;
            if (mergeDefId != it.defId)
            {
                mergeDefId = it.defId;
                mergeItems.Clear();
                PreselectMerge(need);
                if (!mergeItems.Contains(it.instanceId) && mergeItems.Count < need) mergeItems.Add(it.instanceId);
            }
            else if (!mergeItems.Remove(it.instanceId) && mergeItems.Count < need) mergeItems.Add(it.instanceId);
            dirty = true;
        }

        void RedrawMerge(CrafterView v)
        {
            var need = Prices.Catalog.mergeCount > 0 ? Prices.Catalog.mergeCount : 3;
            FillGrid(v.bag, mergeSlots, Entries(BagItems, Array.Empty<ItemStack>()), 20, 10, PickForMerge, e => e is ItemInstance it && mergeItems.Contains(it.instanceId));
            var picked = BagItems.Where(i => mergeItems.Contains(i.instanceId)).OrderByDescending(i => i.@float).ToList();
            for (var i = 0; i < v.inputs.Length; i++)
            {
                var it = i < picked.Count ? picked[i] : null;
                if (it == null) v.inputs[i].SetEmpty();
                else v.inputs[i].SetItem(it.defId, it.tier, 1, false);
                v.inputs[i].Data = it;
                v.inputs[i].Clicked = PickForMerge;
                v.inputNames[i].text = it != null ? FishingController.ItemName(it.defId) : "";
                v.inputFloats[i].text = it != null ? $"{it.@float:0.0000}" : "";
            }
            v.result.SetEmpty();
            v.result.label.text = "?";
            v.resultName.text = mergeDefId != null ? Loc.T("merge.result", ("item", FishingController.ItemName(mergeDefId))) : "";
            var tier = picked.FirstOrDefault()?.tier;
            var cost = tier != null ? Prices.MergeDust(tier) : 0;
            v.mergeDust.text = tier == null ? Loc.T("merge.hint")
                : Loc.T("merge.dust_line", ("dust", cost), ("tier", tier), ("have", Kit.Num(Dust)));
            if (picked.Count > 0)
            {
                var worst = picked.Max(i => i.@float);
                v.mergeQuality.text = Prices.ConditionName(Prices.ConditionOf(worst));
                HudView.Fill(v.mergeFill, 1f - Mathf.Clamp01(worst));
            }
            else
            {
                v.mergeQuality.text = "";
                HudView.Fill(v.mergeFill, 0f);
            }
            v.mergeButton.interactable = !Pending && picked.Count == need && Dust >= cost;
            v.mergeNote.text = Loc.T("merge.note", ("picked", picked.Count), ("need", need), ("lost", need - 1));
        }

        // ----- Banka -----

        void WireBank(BankView v)
        {
            v.window.Closed = Close;
            v.window.Open = false;
            v.expandButton.onClick.AddListener(() => Send(OpCode.StashExpand, new EmptyMsg()));
        }

        void MoveOne(SlotView s, long op)
        {
            if (Pending || s.Data == null) return;
            var body = s.Data switch
            {
                ItemInstance it => new ItemsAndStacksMsg { items = new[] { it.instanceId }, stacks = Array.Empty<ItemStack>() },
                ItemStack st => new ItemsAndStacksMsg { items = Array.Empty<string>(), stacks = new[] { new ItemStack { defId = st.defId, count = st.count } } },
                _ => null,
            };
            if (body != null) Send(op, body);
        }

        void RedrawBank()
        {
            var v = bank;
            if (Stash == null)
            {
                if (!stashRequested && !Pending)
                {
                    stashRequested = true;
                    Send(OpCode.StashOpen, new EmptyMsg());
                }
                v.stashCount.text = Loc.T("bank.opening");
                dirty = true;
                return;
            }
            v.stashCount.text = Loc.T("bank.slots", ("used", Stash.slotsUsed), ("max", Stash.slotsMax));
            FillGrid(v.stash, stashSlots, Entries(Stash.items ?? Array.Empty<ItemInstance>(), Stash.stacks ?? Array.Empty<ItemStack>()), Stash.slotsMax, 10,
                s => MoveOne(s, OpCode.StashTake), null, SlotOrder.For(net.UserId, "stash"), s => MoveOne(s, OpCode.StashTake));
            FillGrid(v.bag, bankBagSlots, Entries(BagItems, BagStacks), fishing.Bag.slotsMax, 8,
                s => MoveOne(s, OpCode.StashPut), null, SlotOrder.For(net.UserId, "bag"), s => MoveOne(s, OpCode.StashPut));
            var tier = Prices.NextStashTier(Stash.level);
            v.expandSlots.text = tier != null ? Loc.T("bank.expand_slots", ("count", tier.slots - Stash.slotsMax)) : Loc.T("bank.max");
            v.expandPrice.text = tier != null ? Kit.Num(tier.price) : "";
            v.expandButton.interactable = !Pending && tier != null && Coin >= tier.price;
        }

        // ----- shared helpers -----

        bool Armed(long op) => confirmArmed && confirmOp == op;

        /// <summary>True when the action should go out now; precious picks need a second click on the same button.</summary>
        bool Act(long op, bool precious)
        {
            if (!precious || Armed(op)) return true;
            confirmArmed = true;
            confirmOp = op;
            return false;
        }

        static ItemsAndStacksMsg SellBody(List<ItemInstance> items, List<KeyValuePair<string, int>> stacks) => new ItemsAndStacksMsg
        {
            items = items.Select(i => i.instanceId).ToArray(),
            stacks = stacks.Select(p => new ItemStack { defId = p.Key, count = p.Value }).ToArray(),
        };

        static string OutputName(CatalogRecipe r) => FishingController.ItemName(r.output.defId);

        void PreselectCraftItems(CatalogRecipe rec)
        {
            foreach (var need in rec.items ?? Array.Empty<ItemStack>())
                foreach (var it in BagItems.Where(i => i.defId == need.defId && !i.locked).OrderByDescending(i => i.@float).Take(need.count))
                    craftItems.Add(it.instanceId);
        }
    }
}
