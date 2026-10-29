using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Economy;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.Social;
using CollectionGame.UI.Views;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// The bag window (uGUI, draft canta-v2): Float items first, then stacks, in 40 px slots.
    /// Hover shows the item; a click opens the menu: Deftere koy (BOOK_PLACE), Kilitle / Kilidi aç
    /// (ITEM_LOCK), Takasa ekle while a trade is open, bait choice for special baits. Opens with B.
    /// </summary>
    public sealed class BagPanel
    {
        const int Columns = 8;

        readonly Connection net;
        readonly FishingController fishing;
        readonly TradeController trade;
        readonly Func<Prices> prices;
        readonly PopupView popup;
        readonly BagView view;
        readonly List<SlotView> slots = new List<SlotView>();

        public BagPanel(Connection net, FishingController fishing, TradeController trade, Func<Prices> prices, PopupView popup)
        {
            this.net = net;
            this.fishing = fishing;
            this.trade = trade;
            this.prices = prices;
            this.popup = popup;
            view = UiRoot.Get().Spawn<BagView>("Bag");
            if (view == null) return;
            view.window.Closed = () => fishing.BagOpen = false;
            view.window.Open = false;
            fishing.BagChanged += Redraw;
        }

        public void Destroy()
        {
            fishing.BagChanged -= Redraw;
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
        }

        /// <summary>Follows FishingController.BagOpen (B key, HUD button).</summary>
        public void Update()
        {
            if (view == null || view.window.Open == fishing.BagOpen) return;
            view.window.Open = fishing.BagOpen;
            if (fishing.BagOpen) Redraw();
            else
            {
                popup?.HideTooltip();
                popup?.HideMenu();
            }
        }

        void Redraw()
        {
            if (view == null || !view.window.Open) return;
            var bag = fishing.Bag;
            if (bag == null)
            {
                view.capacity.text = "...";
                return;
            }
            var entries = new List<object>();
            entries.AddRange((bag.items ?? Array.Empty<ItemInstance>()).OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId).ThenBy(i => i.@float));
            entries.AddRange(bag.stacks ?? Array.Empty<ItemStack>());

            var count = Mathf.Max(bag.slotsMax, entries.Count);
            count = Mathf.CeilToInt(count / (float)Columns) * Columns;
            while (slots.Count < count)
            {
                var s = UnityEngine.Object.Instantiate(view.slotTemplate, view.grid, false);
                s.gameObject.SetActive(true);
                s.Hovered = Hover;
                s.Left = _ => popup?.HideTooltip();
                s.Clicked = s.RightClicked = Menu;
                slots.Add(s);
            }
            for (var i = 0; i < slots.Count; i++)
            {
                var s = slots[i];
                s.gameObject.SetActive(i < count);
                if (i >= entries.Count) s.SetEmpty();
                else if (entries[i] is ItemInstance it) s.SetItem(it.defId, it.tier, 1, it.locked);
                else if (entries[i] is ItemStack st) s.SetItem(st.defId, "", st.count, false);
                s.Data = i < entries.Count ? entries[i] : null;
            }

            var rows = count / Columns;
            var rt = (RectTransform)view.window.transform;
            rt.sizeDelta = new Vector2(rt.sizeDelta.x, 82 + rows * 44);
            view.capacity.text = $"{bag.slotsUsed} / {bag.slotsMax}";
            view.balance.text = $"{Kit.Num(bag.coin)} Coin · {Kit.Num(bag.dust)} toz";
        }

        void Hover(SlotView s)
        {
            if (popup == null || s.Data == null) return;
            popup.ShowTooltip(Describe(s.Data));
        }

        string Describe(object data)
        {
            switch (data)
            {
                case ItemInstance it:
                    var p = prices();
                    var cond = p != null ? $" · {Prices.ConditionName(p.ConditionOf(it.@float))}" : "";
                    return $"<b>{FishingController.ItemName(it.defId)}</b>\n{it.tier}{cond}\nFloat {it.@float:0.0000}{(it.locked ? "\nKilitli" : "")}";
                case ItemStack st:
                    return $"<b>{FishingController.ItemName(st.defId)}</b>\n{st.count} adet";
                default:
                    return "";
            }
        }

        bool CanTrade => trade.Active && !trade.State.youLocked;

        void Menu(SlotView s)
        {
            if (popup == null) return;
            switch (s.Data)
            {
                case ItemInstance it:
                {
                    var entries = new List<(string, Action)>
                    {
                        ("Deftere koy", () => net.Send(OpCode.BookPlace, new BookPlaceMsg { instanceId = it.instanceId })),
                        (it.locked ? "Kilidi aç" : "Kilitle", () => net.Send(OpCode.ItemLock, new ItemLockMsg { instanceId = it.instanceId, locked = !it.locked })),
                        ("Takasa ekle", CanTrade && !it.locked ? () => trade.AddItem(it.instanceId) : (Action)null),
                        ("Sat / Parçala (NPC yanında, E)", null),
                    };
                    popup.ShowMenu($"{FishingController.ItemName(it.defId)} · {it.tier}", entries);
                    break;
                }
                case ItemStack st:
                {
                    var entries = new List<(string, Action)>();
                    if (st.defId.StartsWith("bait."))
                        entries.Add((fishing.SelectedBait == st.defId ? "Temel yeme dön" : "Yem olarak kullan",
                            () => fishing.SelectedBait = fishing.SelectedBait == st.defId ? null : st.defId));
                    entries.Add(("Takasa ekle", CanTrade ? () => trade.ChangeStack(st.defId, st.count, st.count) : (Action)null));
                    entries.Add(("Sat / Parçala (NPC yanında, E)", null));
                    popup.ShowMenu($"{FishingController.ItemName(st.defId)} · {st.count} adet", entries);
                    break;
                }
            }
        }

        /// <summary>ITEM_LOCK_RESULT: the lock lives on the item, so read the bag again.</summary>
        public void OnLockResult(ItemLockResultMsg r)
        {
            if (!r.ok) Toasts.Show(r.reason == "NOT_OWNED" ? "Sadece çantadaki eşya kilitlenir" : $"Kilitlenemedi ({r.reason})", true);
            else Toasts.Show(r.locked ? "Eşya kilitlendi: satılamaz, parçalanamaz, takasa konamaz" : "Kilit açıldı");
            fishing.RefreshBag();
        }
    }
}
