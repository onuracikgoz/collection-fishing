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
    /// Faz 4 on the client (docs/protokol.md, Ekonomi / Birleştirme ve craft / Olta
    /// ve özel yem / Depo): one window with tabs for selling and salvaging, merging
    /// 3 copies into 1, crafting from recipes, the shop (rod repair, special bait)
    /// and the bank stash. Sends intents only (SELL, SALVAGE, MERGE, CRAFT,
    /// REPAIR_ROD, BUY_BAIT, STASH_*); balances, Float and every outcome come from
    /// the server. Prices shown before a click come from get_catalog. Placeholder UI.
    ///
    /// Keys: E opens and closes the window. The stash only works near the bank,
    /// which is marked on the map.
    /// </summary>
    public sealed class EconomyController
    {
        public enum Tab { Sell, Merge, Craft, Shop, Stash }

        static readonly string[] TabNames = { "Sat / Parçala", "Birleştir", "Craft", "Dükkan", "Depo" };
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
        string note;
        bool noteBad;
        float noteUntil;
        Vector2 scroll, scroll2;

        public EconomyController(Connection net, FishingController fishing, Func<Vector2?> myPosition)
        {
            this.net = net;
            this.fishing = fishing;
            this.myPosition = myPosition;
            fishing.BagChanged += PruneSelections;
        }

        /// <summary>Waiting for the server's answer to the last action: buttons stay off.</summary>
        public bool Pending => pendingSince >= 0f && Time.time - pendingSince < ReplyTimeout;

        // ---------- input ----------

        public void Update(bool typing)
        {
            var k = Keyboard.current;
            if (typing || k == null) return;
            if (k.eKey.wasPressedThisFrame)
            {
                if (Open) Close();
                else Show(Current);
            }
        }

        /// <summary>Joined a server: the catalog also places the bank marker.</summary>
        public void OnWelcome()
        {
            if (Prices == null) LoadCatalog();
        }

        public void Show(Tab tab)
        {
            Open = true;
            Current = tab;
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
                ShowNote("Fiyat listesi alınamadı", true);
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
            Debug.Log($"[Economy] ECONOMY_RESULT {r.action} ok {r.ok} {r.reason} gained {r.gained} coin {r.coin} dust {r.dust}");
            SetBalances(r.coin, r.dust);
            if (!r.ok)
            {
                ShowNote(Reason(r.reason), true);
                return;
            }
            ShowNote(r.action == "sell" ? $"Sattın: +{r.gained} Coin" : $"Parçaladın: +{r.gained} toz", false);
            sellItems.Clear();
            sellStacks.Clear();
            fishing.RefreshBag();
        }

        public void OnCraftResult(CraftResultMsg r)
        {
            pendingSince = -1f;
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
                ShowNote($"{(r.action == "merge" ? "Birleştirdin" : "Yaptın")}: {FishingController.ItemName(r.item.defId)} ({r.item.tier}, {Prices.ConditionName(cond)}, Float {r.item.@float:0.0000})", false);
                // The book banners and "Defterdekiyle değiştir?" work off FISH_END's shape.
                if (r.book != null && !string.IsNullOrEmpty(r.book.page))
                    Crafted?.Invoke(new FishEndMsg { id = net.UserId, outcome = FishOutcome.Caught, defId = r.item.defId, item = r.item, book = r.book });
            }
            else if (r.stack != null && !string.IsNullOrEmpty(r.stack.defId))
            {
                ShowNote($"Yaptın: {FishingController.ItemName(r.stack.defId)} (çantada {r.stack.count})", false);
            }
            if (r.action == "merge") mergeItems.Clear();
            else craftItems.Clear();
            fishing.RefreshBag();
        }

        public void OnShopResult(ShopResultMsg r)
        {
            pendingSince = -1f;
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
                ShowNote($"Olta tamir edildi: {r.rod?.durability}/{r.rod?.max} (-{r.spent} Coin)", false);
            }
            else
            {
                if (r.stack != null) fishing.SetStack(r.stack.defId, r.stack.count);
                ShowNote($"Aldın: {FishingController.ItemName(r.stack?.defId)} (çantada {r.stack?.count}, -{r.spent} Coin)", false);
                fishing.RefreshBag(); // slot count
            }
        }

        public void OnStashResult(StashResultMsg r)
        {
            pendingSince = -1f;
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
                    ShowNote("Depoya kondu", false);
                    putItems.Clear();
                    putStacks.Clear();
                    fishing.RefreshBag();
                    break;
                case "take":
                    ShowNote("Çantaya alındı", false);
                    takeItems.Clear();
                    takeStacks.Clear();
                    fishing.RefreshBag();
                    break;
                case "expand":
                    if (fishing.Bag != null) fishing.Bag.coin = r.coin;
                    ShowNote($"Depo büyüdü: {Stash?.slotsMax} kutu", false);
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

        static string Reason(string reason)
        {
            switch (reason)
            {
                case "BAD_REQUEST": return "İstek geçersiz";
                case "TOO_MANY": return "Bir seferde en fazla 40 satır";
                case "NOT_OWNED": return "Eşya çantanda (veya depoda) değil";
                case "NOT_ENOUGH": return "O kadar yok";
                case "CANNOT_SALVAGE": return "Bu parçalanmaz";
                case "NOT_SAME_ITEM": return "Birleştirme için aynı eşyadan 3 kopya gerekir";
                case "NO_RECIPE": return "Bu recipe çantanda yok";
                case "MISSING_INPUTS": return "Malzemeler eksik";
                case "NOT_ENOUGH_DUST": return "Toz yetmiyor";
                case "BAG_FULL": return "Çanta dolu";
                case "NOT_NEEDED": return "Olta zaten sağlam";
                case "NOT_ENOUGH_COIN": return "Coin yetmiyor";
                case "NOT_AT_BANK": return "Depo sadece Banka'da açılır";
                case "STASH_FULL": return "Depo dolu";
                case "MAX_LEVEL": return "Depo en büyük boyutta";
                case "RATE_LIMITED": return "Biraz bekle";
                default: return $"Olmadı ({reason})";
            }
        }

        void ShowNote(string text, bool bad)
        {
            note = text;
            noteBad = bad;
            noteUntil = Time.time + NoteSeconds;
        }

        // ---------- map ----------

        /// <summary>Marks the bank on the map (the stash only opens there). Call from OnGUI.</summary>
        public void DrawMarkers(Camera cam)
        {
            var bank = Prices?.Catalog.stash;
            if (cam == null || bank == null || bank.range <= 0) return;
            var at = Gui.ToGui(cam.WorldToScreenPoint(Coords.ToUnity(new Vector2(bank.x, bank.y))));
            const string label = "Banka (Depo)";
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

        // ---------- UI ----------

        public void DrawGui()
        {
            if (note != null && Time.time < noteUntil)
            {
                var size = Gui.Toast.CalcSize(new GUIContent(note)) + new Vector2(24f, 12f);
                GUI.Box(new Rect((Gui.Width - size.x) / 2f, Gui.Height - Gui.CanvasToGui(230), size.x, size.y), note, Gui.Toast);
            }
            if (!Open) return;

            var r = new Rect(20, 100, Mathf.Min(640, Gui.Width - 40), Mathf.Min(500, Gui.Height - 170));
            Gui.Block(r);
            GUILayout.BeginArea(r, Gui.Window);
            GUILayout.BeginHorizontal();
            GUILayout.Label($"Coin {Coin} · Toz {Dust}", Gui.Header);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Kapat (E)", Gui.Button, GUILayout.Width(100))) Close();
            GUILayout.EndHorizontal();

            var next = (Tab)GUILayout.Toolbar((int)Current, TabNames, Gui.Button);
            if (next != Current)
            {
                Current = next;
                confirmArmed = false;
                scroll = scroll2 = Vector2.zero;
            }
            GUILayout.Space(6);

            if (Prices == null || fishing.Bag == null)
            {
                GUILayout.Label(loadingCatalog || fishing.Bag == null ? "Yükleniyor..." : "Fiyat listesi yok", Gui.Hud);
                if (!loadingCatalog && Prices == null && GUILayout.Button("Tekrar dene", Gui.Button, GUILayout.Width(120))) LoadCatalog();
                GUILayout.EndArea();
                return;
            }

            var wasEnabled = GUI.enabled;
            switch (Current)
            {
                case Tab.Sell: DrawSell(); break;
                case Tab.Merge: DrawMerge(); break;
                case Tab.Craft: DrawCraft(); break;
                case Tab.Shop: DrawShop(); break;
                case Tab.Stash: DrawStash(); break;
            }
            GUI.enabled = wasEnabled;
            GUILayout.EndArea();
        }

        ItemInstance[] BagItems => fishing.Bag?.items ?? Array.Empty<ItemInstance>();
        ItemStack[] BagStacks => fishing.Bag?.stacks ?? Array.Empty<ItemStack>();

        string ItemLine(ItemInstance it) =>
            $"{FishingController.ItemName(it.defId)} · {it.tier} · {Prices.ConditionName(Prices.ConditionOf(it.@float))} · Float {it.@float:0.0000}";

        /// <summary>A "- n +  Hepsi" picker; returns the new value in [0, max].</summary>
        static int CountPicker(int value, int max)
        {
            if (GUILayout.Button("-", Gui.Button, GUILayout.Width(26))) value--;
            GUILayout.Label(value.ToString(), Gui.Hud, GUILayout.Width(30));
            if (GUILayout.Button("+", Gui.Button, GUILayout.Width(26))) value++;
            if (GUILayout.Button("Hepsi", Gui.Button, GUILayout.Width(60))) value = max;
            return Mathf.Clamp(value, 0, max);
        }

        // ----- Sat / Parçala -----

        void DrawSell()
        {
            GUILayout.Label("Satış Coin verir, parçalamak toz. Float sadece satış fiyatını etkiler. Defterdeki ve depodaki eşyalar burada görünmez.", Gui.Faint);
            scroll = GUILayout.BeginScrollView(scroll);
            foreach (var it in BagItems.OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId).ThenByDescending(i => i.@float))
            {
                GUILayout.BeginHorizontal(GUI.skin.box);
                var on = sellItems.Contains(it.instanceId);
                var now = GUILayout.Toggle(on, ItemLine(it), GUILayout.ExpandWidth(true));
                if (now != on)
                {
                    if (now) sellItems.Add(it.instanceId);
                    else sellItems.Remove(it.instanceId);
                    confirmArmed = false;
                }
                GUILayout.Label($"{Prices.SellPrice(it)} Coin / {Prices.DustOf(it)} toz", Gui.Faint, GUILayout.Width(140));
                GUILayout.EndHorizontal();
            }
            foreach (var st in BagStacks)
            {
                var sell = Prices.SellPrice(st.defId);
                var dust = Prices.DustOf(st.defId);
                GUILayout.BeginHorizontal(GUI.skin.box);
                GUILayout.Label($"{FishingController.ItemName(st.defId)} x {st.count}", Gui.Hud, GUILayout.Width(190));
                GUILayout.Label(sell == 0 && dust == 0 ? "satılmaz" : $"{(sell > 0 ? $"{sell} Coin" : "satılmaz")} / {(dust > 0 ? $"{dust} toz" : "parçalanmaz")} (adet)", Gui.Faint, GUILayout.Width(190));
                GUILayout.FlexibleSpace();
                if (sell > 0 || dust > 0)
                {
                    sellStacks.TryGetValue(st.defId, out var n);
                    var m = CountPicker(n, st.count);
                    if (m != n) confirmArmed = false;
                    if (m > 0) sellStacks[st.defId] = m;
                    else sellStacks.Remove(st.defId);
                }
                GUILayout.EndHorizontal();
            }
            if (BagItems.Length == 0 && BagStacks.Length == 0) GUILayout.Label("Çanta boş", Gui.Faint);
            GUILayout.EndScrollView();

            var items = BagItems.Where(i => sellItems.Contains(i.instanceId)).ToList();
            var stacks = sellStacks.Where(p => p.Value > 0).ToList();
            var coin = items.Sum(i => (long)Prices.SellPrice(i)) + stacks.Sum(p => (long)Prices.SellPrice(p.Key) * p.Value);
            var dustSum = items.Sum(i => (long)Prices.DustOf(i)) + stacks.Sum(p => (long)Prices.DustOf(p.Key) * p.Value);
            var lines = items.Count + stacks.Count;
            var canSell = lines > 0 && stacks.All(p => Prices.SellPrice(p.Key) > 0);
            var canSalvage = lines > 0 && items.All(i => Prices.DustOf(i) > 0) && stacks.All(p => Prices.DustOf(p.Key) > 0);
            // Rare and up, or a clean copy, needs a second click: selling is final.
            var precious = items.Any(i => Tiers.Rank(i.tier) >= Tiers.Rank(Tiers.Rare) || Prices.ConditionOf(i.@float) == "pristine")
                || stacks.Any(p => Prices.Stack(p.Key)?.category == "recipe");

            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Tüm çöpü seç", Gui.Button, GUILayout.Width(120)))
                foreach (var st in BagStacks)
                    if (Prices.Stack(st.defId)?.category == "junk") sellStacks[st.defId] = st.count;
            if (GUILayout.Button("Temizle", Gui.Button, GUILayout.Width(80)))
            {
                sellItems.Clear();
                sellStacks.Clear();
                confirmArmed = false;
            }
            GUILayout.FlexibleSpace();
            var max = Prices.Catalog.maxEntries > 0 ? Prices.Catalog.maxEntries : 40;
            if (lines > max) GUILayout.Label($"En fazla {max} satır", Gui.Warn);
            const string sure = "Emin misin? Tekrar bas";
            GUI.enabled = !Pending && lines <= max && canSell;
            if (GUILayout.Button(Armed(OpCode.Sell) ? sure : $"Sat (+{coin} Coin)", Gui.Button, GUILayout.Width(170)) && Act(OpCode.Sell, precious))
                Send(OpCode.Sell, SellBody(items, stacks));
            GUI.enabled = !Pending && lines <= max && canSalvage;
            if (GUILayout.Button(Armed(OpCode.Salvage) ? sure : $"Parçala (+{dustSum} toz)", Gui.Button, GUILayout.Width(170)) && Act(OpCode.Salvage, precious))
                Send(OpCode.Salvage, SellBody(items, stacks));
            GUI.enabled = true;
            GUILayout.EndHorizontal();
        }

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

        // ----- Birleştir -----

        void DrawMerge()
        {
            var need = Prices.Catalog.mergeCount > 0 ? Prices.Catalog.mergeCount : 3;
            GUILayout.Label($"Aynı eşyadan {need} kopya + toz = 1 kopya, yeni Float. Tier değişmez, sonuç en kötü girdiden kötü çıkmaz.", Gui.Faint);
            var groups = BagItems.GroupBy(i => i.defId).Where(g => g.Count() >= need).OrderBy(g => Tiers.Rank(g.First().tier)).ThenBy(g => g.Key).ToList();
            if (groups.Count == 0)
            {
                GUILayout.Label($"Çantanda {need} kopyası olan eşya yok.", Gui.Hud);
                return;
            }

            GUILayout.BeginHorizontal();
            scroll = GUILayout.BeginScrollView(scroll, GUILayout.Width(210));
            foreach (var g in groups)
            {
                var label = $"{FishingController.ItemName(g.Key)} ({g.First().tier}) x {g.Count()}";
                if (GUILayout.Toggle(mergeDefId == g.Key, label, Gui.Button) && mergeDefId != g.Key)
                {
                    mergeDefId = g.Key;
                    mergeItems.Clear();
                    PreselectMerge(need);
                }
            }
            GUILayout.EndScrollView();

            GUILayout.BeginVertical();
            var group = groups.FirstOrDefault(g => g.Key == mergeDefId);
            if (group == null) GUILayout.Label("Soldan bir eşya seç.", Gui.Hud);
            else
            {
                scroll2 = GUILayout.BeginScrollView(scroll2);
                foreach (var it in group.OrderByDescending(i => i.@float))
                {
                    var on = mergeItems.Contains(it.instanceId);
                    var now = GUILayout.Toggle(on, ItemLine(it));
                    if (now && !on && mergeItems.Count < need) mergeItems.Add(it.instanceId);
                    else if (!now && on) mergeItems.Remove(it.instanceId);
                }
                GUILayout.EndScrollView();
                var tier = group.First().tier;
                var cost = Prices.MergeDust(tier);
                var picked = group.Where(i => mergeItems.Contains(i.instanceId)).ToList();
                GUILayout.Label($"Seçili {picked.Count}/{need} · Toz {cost} (sende {Dust})", Dust >= cost ? Gui.Hud : Gui.Warn);
                if (picked.Count > 0)
                    GUILayout.Label($"Sonuç en kötü: Float {picked.Max(i => i.@float):0.0000}", Gui.Faint);
                GUI.enabled = !Pending && picked.Count == need && Dust >= cost;
                if (GUILayout.Button("Birleştir", Gui.Button, GUILayout.Height(30)))
                    Send(OpCode.Merge, new MergeMsg { items = picked.Select(i => i.instanceId).ToArray() });
                GUI.enabled = true;
            }
            GUILayout.EndVertical();
            GUILayout.EndHorizontal();
        }

        // ----- Craft -----

        void DrawCraft()
        {
            var owned = (Prices.Catalog.recipes ?? Array.Empty<CatalogRecipe>()).Where(r => fishing.StackCount(r.id) > 0).ToList();
            GUILayout.Label("Recipe tek kullanımlıktır. Recipe balıktan \"şişedeki recipe\" olarak çıkar.", Gui.Faint);
            if (owned.Count == 0)
            {
                GUILayout.Label("Çantanda recipe yok.", Gui.Hud);
                return;
            }

            GUILayout.BeginHorizontal();
            scroll = GUILayout.BeginScrollView(scroll, GUILayout.Width(210));
            foreach (var rec in owned)
            {
                var label = $"{OutputName(rec)} x {fishing.StackCount(rec.id)}";
                if (GUILayout.Toggle(recipeId == rec.id, label, Gui.Button) && recipeId != rec.id)
                {
                    recipeId = rec.id;
                    craftItems.Clear();
                    PreselectCraftItems(rec);
                }
            }
            GUILayout.EndScrollView();

            GUILayout.BeginVertical();
            var recipe = owned.FirstOrDefault(x => x.id == recipeId);
            if (recipe == null) GUILayout.Label("Soldan bir recipe seç.", Gui.Hud);
            else DrawRecipe(recipe);
            GUILayout.EndVertical();
            GUILayout.EndHorizontal();
        }

        static string OutputName(CatalogRecipe r) => FishingController.ItemName(r.output.defId);

        void PreselectCraftItems(CatalogRecipe rec)
        {
            foreach (var need in rec.items ?? Array.Empty<ItemStack>())
                foreach (var it in BagItems.Where(i => i.defId == need.defId).OrderByDescending(i => i.@float).Take(need.count))
                    craftItems.Add(it.instanceId);
        }

        void DrawRecipe(CatalogRecipe rec)
        {
            var output = rec.output.count > 0 ? $"{OutputName(rec)} x {rec.output.count}" : $"{OutputName(rec)} ({rec.output.tier})";
            GUILayout.Label($"Çıkan: {output}", Gui.Header);
            var gradeNote = Prices.GradeNote(rec.grade);
            GUILayout.Label($"Recipe: {Prices.GradeName(rec.grade)}{(gradeNote.Length > 0 ? $" ({gradeNote})" : "")}", Gui.Hud);

            var ready = true;
            foreach (var st in rec.stacks ?? Array.Empty<ItemStack>())
            {
                var have = fishing.StackCount(st.defId);
                ready &= have >= st.count;
                GUILayout.Label($"{FishingController.ItemName(st.defId)}: {have}/{st.count}", have >= st.count ? Gui.Good : Gui.Warn);
            }

            var picked = new List<ItemInstance>();
            scroll2 = GUILayout.BeginScrollView(scroll2);
            foreach (var need in rec.items ?? Array.Empty<ItemStack>())
            {
                var copies = BagItems.Where(i => i.defId == need.defId).OrderByDescending(i => i.@float).ToList();
                var chosen = copies.Where(i => craftItems.Contains(i.instanceId)).ToList();
                ready &= chosen.Count == need.count;
                GUILayout.Label($"{FishingController.ItemName(need.defId)}: seçili {chosen.Count}/{need.count}", chosen.Count == need.count ? Gui.Good : Gui.Warn);
                foreach (var it in copies)
                {
                    var on = craftItems.Contains(it.instanceId);
                    var now = GUILayout.Toggle(on, "  " + ItemLine(it));
                    if (now && !on && chosen.Count < need.count) craftItems.Add(it.instanceId);
                    else if (!now && on) craftItems.Remove(it.instanceId);
                }
                picked.AddRange(chosen);
            }
            GUILayout.EndScrollView();

            if (rec.output.count == 0)
            {
                float? avg = picked.Count > 0 ? picked.Average(i => i.@float) : (float?)null;
                GUILayout.Label($"Kalite şansı: {Prices.QualityWord(avg)}", Gui.Hud);
            }
            GUILayout.Label($"Toz {rec.dust} (sende {Dust})", Dust >= rec.dust ? Gui.Hud : Gui.Warn);
            GUI.enabled = !Pending && ready && Dust >= rec.dust;
            if (GUILayout.Button("Craft", Gui.Button, GUILayout.Height(30)))
                Send(OpCode.Craft, new CraftMsg { recipeId = rec.id, items = picked.Select(i => i.instanceId).ToArray() });
            GUI.enabled = true;
        }

        // ----- Dükkan -----

        void DrawShop()
        {
            var rod = fishing.Rod;
            GUILayout.Label("Olta", Gui.Header);
            if (rod == null || rod.max <= 0) GUILayout.Label("Olta bilgisi yok", Gui.Faint);
            else
            {
                GUILayout.Label($"Seviye {rod.level} · Dayanıklılık {rod.durability}/{rod.max}{(fishing.RodBroken ? " · KIRIK: sadece çöp çıkar" : "")}", fishing.RodBroken ? Gui.Warn : Gui.Hud);
                var cost = Prices.RepairCost(rod);
                GUILayout.BeginHorizontal();
                if (cost == 0) GUILayout.Label("Tamire gerek yok", Gui.Faint);
                else
                {
                    if (Coin < cost) GUILayout.Label("Coin yettiği kadar tamir edilir", Gui.Faint);
                    GUILayout.FlexibleSpace();
                    GUI.enabled = !Pending && Coin > 0;
                    if (GUILayout.Button($"Tamir et ({Math.Min(cost, Coin)} Coin)", Gui.Button, GUILayout.Width(190)))
                        Send(OpCode.RepairRod, new EmptyMsg());
                    GUI.enabled = true;
                }
                GUILayout.EndHorizontal();
            }

            GUILayout.Space(10);
            GUILayout.Label("Özel yem", Gui.Header);
            GUILayout.Label("Yem sadece oranları kaydırır, yeni eşya eklemez. Her atış 1 yem harcar. Balık tutarken Y ile seçilir.", Gui.Faint);
            var maxBuy = Prices.Catalog.maxBuy > 0 ? Prices.Catalog.maxBuy : 99;
            foreach (var bait in Prices.Catalog.baits ?? Array.Empty<CatalogBait>())
            {
                GUILayout.BeginHorizontal(GUI.skin.box);
                GUILayout.Label($"{FishingController.ItemName(bait.defId)} · {bait.price} Coin · çantada {fishing.StackCount(bait.defId)}", Gui.Hud, GUILayout.Width(250));
                if (!buyCounts.TryGetValue(bait.defId, out var n)) n = 5;
                if (GUILayout.Button("-", Gui.Button, GUILayout.Width(26))) n--;
                GUILayout.Label(n.ToString(), Gui.Hud, GUILayout.Width(26));
                if (GUILayout.Button("+", Gui.Button, GUILayout.Width(26))) n++;
                n = Mathf.Clamp(n, 1, maxBuy);
                buyCounts[bait.defId] = n;
                GUI.enabled = !Pending && Coin >= (long)n * bait.price;
                if (GUILayout.Button($"Al ({n * bait.price})", Gui.Button, GUILayout.Width(90)))
                    Send(OpCode.BuyBait, new BuyBaitMsg { defId = bait.defId, count = n });
                GUI.enabled = fishing.StackCount(bait.defId) > 0;
                var using_ = fishing.SelectedBait == bait.defId;
                if (GUILayout.Button(using_ ? "Kullanılıyor" : "Kullan", Gui.Button, GUILayout.Width(100)))
                    fishing.SelectedBait = using_ ? null : bait.defId;
                GUI.enabled = true;
                GUILayout.EndHorizontal();
            }
        }

        // ----- Depo -----

        void DrawStash()
        {
            var bank = Prices.Catalog.stash;
            var dist = BankDistance();
            var near = bank != null && dist.HasValue && dist.Value <= bank.range;
            if (!near)
            {
                Stash = null;
                stashRequested = false;
                GUILayout.Label("Depo sadece Banka'da açılır (haritada \"Banka\" yazan yer).", Gui.Hud);
                if (dist.HasValue) GUILayout.Label($"Banka {dist.Value:0} tile uzakta.", Gui.Faint);
                return;
            }
            if (Stash == null)
            {
                if (!stashRequested && !Pending)
                {
                    stashRequested = true;
                    Send(OpCode.StashOpen, new EmptyMsg());
                }
                GUILayout.Label("Depo açılıyor...", Gui.Hud);
                if (!Pending && GUILayout.Button("Tekrar dene", Gui.Button, GUILayout.Width(120))) stashRequested = false;
                return;
            }

            GUILayout.BeginHorizontal();
            GUILayout.Label($"Çanta {fishing.Bag.slotsUsed}/{fishing.Bag.slotsMax}", Gui.Header, GUILayout.Width(280));
            GUILayout.Label($"Depo {Stash.slotsUsed}/{Stash.slotsMax}", Gui.Header);
            GUILayout.EndHorizontal();

            GUILayout.BeginHorizontal();
            scroll = GUILayout.BeginScrollView(scroll, GUILayout.Width(290));
            DrawMoveList(BagItems, BagStacks, putItems, putStacks);
            GUILayout.EndScrollView();
            scroll2 = GUILayout.BeginScrollView(scroll2);
            DrawMoveList(Stash.items ?? Array.Empty<ItemInstance>(), Stash.stacks ?? Array.Empty<ItemStack>(), takeItems, takeStacks);
            GUILayout.EndScrollView();
            GUILayout.EndHorizontal();

            var max = bank.maxEntries > 0 ? bank.maxEntries : 40;
            var putLines = putItems.Count + putStacks.Count(p => p.Value > 0);
            var takeLines = takeItems.Count + takeStacks.Count(p => p.Value > 0);
            GUILayout.BeginHorizontal();
            GUI.enabled = !Pending && putLines > 0 && putLines <= max;
            if (GUILayout.Button($"Depoya koy ({putLines})", Gui.Button, GUILayout.Width(170)))
                Send(OpCode.StashPut, MoveBody(putItems, putStacks));
            GUI.enabled = !Pending && takeLines > 0 && takeLines <= max;
            if (GUILayout.Button($"Çantaya al ({takeLines})", Gui.Button, GUILayout.Width(170)))
                Send(OpCode.StashTake, MoveBody(takeItems, takeStacks));
            GUILayout.FlexibleSpace();
            var tier = Prices.NextStashTier(Stash.level);
            GUI.enabled = !Pending && tier != null && Coin >= tier.price;
            if (GUILayout.Button(tier == null ? "En büyük depo" : $"Genişlet: {tier.slots} kutu ({tier.price} Coin)", Gui.Button, GUILayout.Width(230)))
                Send(OpCode.StashExpand, new EmptyMsg());
            GUI.enabled = true;
            GUILayout.EndHorizontal();
        }

        void DrawMoveList(ItemInstance[] items, ItemStack[] stacks, HashSet<string> pickItems, Dictionary<string, int> pickStacks)
        {
            foreach (var it in items.OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId))
            {
                var on = pickItems.Contains(it.instanceId);
                var now = GUILayout.Toggle(on, $"{FishingController.ItemName(it.defId)} · {it.tier} · {it.@float:0.000}");
                if (now) pickItems.Add(it.instanceId);
                else pickItems.Remove(it.instanceId);
            }
            foreach (var st in stacks)
            {
                GUILayout.BeginHorizontal();
                GUILayout.Label($"{FishingController.ItemName(st.defId)} x {st.count}", Gui.Hud, GUILayout.Width(110));
                pickStacks.TryGetValue(st.defId, out var n);
                var m = CountPicker(n, st.count);
                if (m > 0) pickStacks[st.defId] = m;
                else pickStacks.Remove(st.defId);
                GUILayout.EndHorizontal();
            }
            if (items.Length == 0 && stacks.Length == 0) GUILayout.Label("Boş", Gui.Faint);
        }

        static ItemsAndStacksMsg MoveBody(HashSet<string> items, Dictionary<string, int> stacks) => new ItemsAndStacksMsg
        {
            items = items.ToArray(),
            stacks = stacks.Where(p => p.Value > 0).Select(p => new ItemStack { defId = p.Key, count = p.Value }).ToArray(),
        };
    }
}
