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
    /// The bag window (uGUI, draft canta-v2) in 40 px slots. Hover shows the item card; a click opens
    /// the menu: Deftere koy (BOOK_PLACE), Kilitle / Kilidi aç (ITEM_LOCK), Takasa ekle while a trade is
    /// open, bait choice for special baits, Çöpe at. Drag a slot onto another to swap them (the order is
    /// kept on this device, SlotOrder), onto the trash can to throw it away after "Emin misin?"
    /// (ITEM_DISCARD), onto your side of the trade to offer it. Opens with B.
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
        SlotOrder order;
        object[] laid = Array.Empty<object>();

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
            order ??= SlotOrder.For(net.UserId, "bag");
            laid = order.Lay(entries, count);
            count = Mathf.CeilToInt(laid.Length / (float)Columns) * Columns;
            while (slots.Count < count)
            {
                var s = UnityEngine.Object.Instantiate(view.slotTemplate, view.grid, false);
                s.gameObject.SetActive(true);
                s.Hovered = Hover;
                s.Left = _ => popup?.HideTooltip();
                s.Clicked = Click;
                s.RightClicked = Menu;
                s.DragBegan = BeginDrag;
                s.Dragged = MoveDrag;
                s.Dropped = Drop;
                slots.Add(s);
            }
            for (var i = 0; i < slots.Count; i++)
            {
                var s = slots[i];
                s.gameObject.SetActive(i < count);
                var e = i < laid.Length ? laid[i] : null;
                if (e is ItemInstance it) s.SetItem(it.defId, it.tier, 1, it.locked);
                else if (e is ItemStack st) s.SetItem(st.defId, "", st.count, false);
                else s.SetEmpty();
                s.Data = e;
            }

            var rows = count / Columns;
            var rt = (RectTransform)view.window.transform;
            rt.sizeDelta = new Vector2(rt.sizeDelta.x, 89 + rows * 44); // canta-v2: 309 for 5 rows
            view.capacity.text = $"{bag.slotsUsed} / {bag.slotsMax}";
            view.balance.text = $"{Kit.Num(bag.coin)} Coin · {Kit.Num(bag.dust)} toz";
        }

        void Hover(SlotView s)
        {
            if (popup == null || s.Data == null) return;
            switch (s.Data)
            {
                case ItemInstance it:
                    popup.ShowTooltip(ItemText.Card(it, prices(), "Tıkla: işlemler · Sürükle: taşı"));
                    break;
                case ItemStack st:
                    popup.ShowTooltip(ItemText.Card(st, "Tıkla: işlemler · Sürükle: taşı"));
                    break;
            }
        }

        /// <summary>Left click: with a trade open the item goes to the trade, else the menu opens.</summary>
        void Click(SlotView s)
        {
            if (CanTrade && Give(s.Data)) return;
            Menu(s);
        }

        bool Give(object data)
        {
            switch (data)
            {
                case ItemInstance it when !it.locked:
                    trade.Offer(it);
                    return true;
                case ItemStack st:
                    trade.Offer(st);
                    return true;
                default:
                    return false;
            }
        }

        // ----- drag: onto another slot (swap), the trash can (throw away) or the trade window (offer) -----

        SlotView ghost;

        void BeginDrag(SlotView s, UnityEngine.EventSystems.PointerEventData e)
        {
            if (s.Data == null) return;
            popup?.HideTooltip();
            popup?.HideMenu();
            ghost = UnityEngine.Object.Instantiate(s, UiRoot.Get().transform, false);
            ghost.name = "DragGhost";
            var group = ghost.gameObject.AddComponent<CanvasGroup>();
            group.blocksRaycasts = false;
            group.alpha = 0.85f;
            ghost.transform.SetAsLastSibling();
            if (s.icon != null) s.icon.color = new Color(1f, 1f, 1f, 0.35f); // the slot it left fades while dragging
            MoveDrag(s, e);
        }

        void MoveDrag(SlotView s, UnityEngine.EventSystems.PointerEventData e)
        {
            if (ghost == null) return;
            var rt = (RectTransform)ghost.transform;
            rt.anchorMin = rt.anchorMax = Vector2.zero;
            rt.pivot = new Vector2(0.5f, 0.5f);
            RectTransformUtility.ScreenPointToLocalPointInRectangle(UiRoot.Get().Rect, e.position, null, out var local);
            rt.anchoredPosition = local - UiRoot.Get().Rect.rect.min;
            if (view.trashHighlight != null) view.trashHighlight.enabled = OverTrash(e.position);
        }

        bool OverTrash(Vector2 screen) => view.trash != null && RectTransformUtility.RectangleContainsScreenPoint(view.trash, screen, null);

        void Drop(SlotView s, UnityEngine.EventSystems.PointerEventData e)
        {
            if (ghost == null) return;
            UnityEngine.Object.Destroy(ghost.gameObject);
            ghost = null;
            if (view.trashHighlight != null) view.trashHighlight.enabled = false;
            if (s.icon != null) s.icon.color = Color.white;
            var data = s.Data;
            if (OverTrash(e.position))
            {
                AskDiscard(data);
                return;
            }
            if (CanTrade && trade.OverMySide(e.position))
            {
                Give(data);
                return;
            }
            var target = slots.FirstOrDefault(t => t.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint((RectTransform)t.transform, e.position, null));
            if (target == null || target == s || order == null) return;
            order.Swap(laid, slots.IndexOf(s), slots.IndexOf(target));
            Redraw();
        }

        /// <summary>The trash can: "Emin misin?", then ITEM_DISCARD; the server decides (locked items stay).</summary>
        void AskDiscard(object data)
        {
            switch (data)
            {
                case ItemInstance it when it.locked:
                    Toasts.Show("Kilitli eşya atılamaz, önce kilidi aç", true);
                    break;
                case ItemInstance it:
                    ConfirmView.Show("Emin misin?", $"{FishingController.ItemName(it.defId)} ({it.tier}) çöpe atılacak. Geri gelmez.", "Çöpe at",
                        () => net.Send(OpCode.ItemDiscard, new ItemDiscardMsg { instanceId = it.instanceId }));
                    break;
                case ItemStack st:
                    ConfirmView.Show("Emin misin?", $"{FishingController.ItemName(st.defId)} x{st.count} çöpe atılacak. Geri gelmez.", "Çöpe at",
                        () => net.Send(OpCode.ItemDiscard, new ItemDiscardMsg { defId = st.defId, count = st.count }));
                    break;
            }
        }

        /// <summary>ITEM_DISCARD_RESULT: read the bag again, say why when it was refused.</summary>
        public void OnDiscardResult(ItemDiscardResultMsg r)
        {
            if (r.ok) Toasts.Show($"{FishingController.ItemName(r.defId)} çöpe atıldı");
            else Toasts.Show(r.reason == "LOCKED" ? "Kilitli eşya atılamaz" : r.reason == "BUSY" ? "Takas sürerken eşya atılamaz" : r.reason == "NOT_OWNED" ? "Eşya çantada değil" : $"Atılamadı ({r.reason})", true);
            fishing.RefreshBag();
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
                        ("Çöpe at", !it.locked ? () => AskDiscard(it) : (Action)null),
                    };
                    popup.ShowMenu(FishingController.ItemName(it.defId), it.tier, ItemText.TierColour(it.tier), entries);
                    break;
                }
                case ItemStack st:
                {
                    var entries = new List<(string, Action)>();
                    if (st.defId.StartsWith("bait."))
                        entries.Add((fishing.SelectedBait == st.defId ? "Temel yeme dön" : "Yem olarak kullan",
                            () => fishing.SelectedBait = fishing.SelectedBait == st.defId ? null : st.defId));
                    entries.Add(("Takasa ekle", CanTrade ? () => trade.ChangeStack(st.defId, st.count, st.count) : (Action)null));
                    entries.Add(("Çöpe at", () => AskDiscard(st)));
                    popup.ShowMenu(FishingController.ItemName(st.defId), $"{Kit.Num(st.count)} adet", null, entries);
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
