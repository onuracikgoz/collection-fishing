using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Economy;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine.EventSystems;
using UnityEngine;

namespace CollectionGame.Social
{
    /// <summary>
    /// Safe trade window (docs/protokol.md, Takas; drafts takas-a/b/c). Sends intents only:
    /// TRADE_OFFER / REPLY / SET / LOCK / CONFIRM / CANCEL. The window always shows the server's
    /// TRADE_STATE: a click sends my whole new side and waits for the next state. Both locks,
    /// then a countdown, then Onayla; any change opens both locks again.
    /// </summary>
    public sealed class TradeController
    {
        readonly Connection net;
        readonly FishingController fishing;
        readonly Func<Prices> prices;

        public TradeInviteMsg Invite { get; private set; }
        public TradeStateMsg State { get; private set; }
        public TradeEndMsg LastEnd { get; private set; }
        /// <summary>A traded item that went to the book, shaped like FISH_END for the book banners.</summary>
        public Action<FishEndMsg> BookOutcome { get; set; }

        /// <summary>The window is open: the server ignores MOVE and CAST, so the client does not send them.</summary>
        public bool Active => State != null;

        float inviteAt, stateAt;

        public TradeController(Connection net, FishingController fishing, Func<Prices> prices)
        {
            this.net = net;
            this.fishing = fishing;
            this.prices = prices;
            fishing.BagChanged += () => dirty = true;
        }

        // ---------- intents ----------

        public void Offer(string userId, string name)
        {
            if (string.IsNullOrEmpty(userId) || userId == net.UserId) return;
            net.Send(OpCode.TradeOffer, new TradeOfferMsg { userId = userId });
            Toasts.Show(Loc.T("trade.offer_sent", ("name", name)));
        }

        void Reply(bool accept)
        {
            net.Send(OpCode.TradeReply, new TradeReplyMsg { accept = accept });
            if (!accept) Invite = null;
        }

        void Cancel() => net.Send(OpCode.TradeCancel, new EmptyMsg());

        /// <summary>My whole side, changed by one click.</summary>
        void SendSide(IEnumerable<string> items, IDictionary<string, int> stacks, int coin)
        {
            net.Send(OpCode.TradeSet, new TradeSetMsg
            {
                items = items.ToArray(),
                stacks = stacks.Where(p => p.Value > 0).Select(p => new ItemStack { defId = p.Key, count = p.Value }).ToArray(),
                coin = Mathf.Max(0, coin),
            });
        }

        List<string> MyItems => (State?.you?.items ?? Array.Empty<ItemInstance>()).Select(i => i.instanceId).ToList();

        Dictionary<string, int> MyStacks
        {
            get
            {
                var d = new Dictionary<string, int>();
                foreach (var s in State?.you?.stacks ?? Array.Empty<ItemStack>()) d[s.defId] = s.count;
                return d;
            }
        }

        int MyCoin => State?.you?.coin ?? 0;

        /// <summary>Adds a bag item to my side (bag right-click "Takasa ekle").</summary>
        public void AddItem(string id)
        {
            var items = MyItems;
            if (!items.Contains(id)) items.Add(id);
            SendSide(items, MyStacks, MyCoin);
        }

        void RemoveItem(string id)
        {
            var items = MyItems;
            items.Remove(id);
            SendSide(items, MyStacks, MyCoin);
        }

        /// <summary>Moves delta of a stack to (or from) my side, kept within [0, max].</summary>
        public void ChangeStack(string defId, int delta, int max)
        {
            var stacks = MyStacks;
            stacks.TryGetValue(defId, out var n);
            stacks[defId] = Mathf.Clamp(n + delta, 0, max);
            SendSide(MyItems, stacks, MyCoin);
        }

        // ---------- server ----------

        public void OnInvite(TradeInviteMsg m)
        {
            Invite = m;
            inviteAt = Time.time;
            Debug.Log($"[Trade] INVITE from {m.name} {m.tradeId}");
        }

        public void OnState(TradeStateMsg m)
        {
            var opening = State == null;
            State = m;
            stateAt = Time.time;
            Invite = null;
            dirty = true;
            if (opening) fishing.RefreshBag();
            if (!string.IsNullOrEmpty(m.reason)) Toasts.Show(StateReason(m.reason), true);
            Debug.Log($"[Trade] STATE locks {m.youLocked}/{m.themLocked} confirmed {m.youConfirmed}/{m.themConfirmed} in {m.confirmInMs} {m.reason}");
        }

        public void OnEnd(TradeEndMsg m)
        {
            LastEnd = m;
            State = null;
            Invite = null;
            GUIUtility.keyboardControl = 0;
            Debug.Log($"[Trade] END {m.result} {m.reason}");
            switch (m.result)
            {
                case "done":
                    var got = m.got;
                    var parts = new List<string>();
                    foreach (var it in got?.items ?? Array.Empty<ItemInstance>()) parts.Add(FishingController.ItemName(it.defId));
                    foreach (var st in got?.stacks ?? Array.Empty<ItemStack>()) parts.Add($"{FishingController.ItemName(st.defId)} x{st.count}");
                    if (got != null && got.coin > 0) parts.Add($"{Kit.Num(got.coin)} Coin");
                    Toasts.Money(Loc.T("trade.done"), parts.Count > 0 ? Loc.T("trade.got", ("list", string.Join(", ", parts))) : null);
                    foreach (var b in m.book ?? Array.Empty<TradeBookResult>())
                    {
                        var item = got?.items?.FirstOrDefault(i => i.instanceId == b.instanceId);
                        if (item != null && !string.IsNullOrEmpty(b.page))
                            BookOutcome?.Invoke(new FishEndMsg { id = net.UserId, outcome = FishOutcome.Caught, defId = item.defId, item = item, book = b });
                    }
                    break;
                case "declined": Toasts.Show(Loc.T("trade.declined")); break;
                case "expired": Toasts.Show(Loc.T("trade.expired")); break;
                case "cancelled": Toasts.Show(string.IsNullOrEmpty(m.reason) ? Loc.T("trade.cancelled") : EndReason(m), !string.IsNullOrEmpty(m.reason)); break;
                default: Toasts.Show(EndReason(m), true); break;
            }
            fishing.RefreshBag();
        }

        string EndReason(TradeEndMsg m)
        {
            switch (m.reason)
            {
                case "BAG_FULL": return Loc.T(m.userId == net.UserId ? "trade.end.BAG_FULL_SELF" : "trade.end.BAG_FULL_OTHER");
                case null: case "": return Loc.T("trade.end.UNKNOWN");
                default: return Loc.Reason("trade.end", m.reason);
            }
        }

        static string StateReason(string r) => Loc.Reason("trade", r);

        // ---------- UI (uGUI: Resources/UI/Trade after takas-a/b/c, TradeInvite, Count) ----------

        static readonly Color Brown = new Color32(0x7a, 0x30, 0x45, 255);
        static readonly Color Green = new Color32(0x1e, 0x6f, 0x50, 255);
        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);

        TradeView view;
        InviteView invite;
        /// <summary>Tiles to another player, if in view (the offer box says how far). Set by the world.</summary>
        public Func<string, float?> DistanceTo { get; set; }
        CountView count;
        bool dirty = true;
        /// <summary>Tooltip / menu shared by the windows (set by the world).</summary>
        public PopupView Popup { get; set; }

        public void Destroy()
        {
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
            if (invite != null) UnityEngine.Object.Destroy(invite.gameObject);
            if (count != null) UnityEngine.Object.Destroy(count.gameObject);
        }

        bool Ensure()
        {
            if (view != null && invite != null && count != null) return true;
            var ui = UiRoot.Get();
            if (view == null && (view = ui.Spawn<TradeView>("Trade")) != null)
            {
                view.window.Closed = Cancel;
                view.window.Open = false;
                view.lockButton.onClick.AddListener(() => net.Send(OpCode.TradeLock, new TradeLockMsg { locked = State != null && !State.youLocked }));
                view.confirm.onClick.AddListener(() => net.Send(OpCode.TradeConfirm, new EmptyMsg()));
                view.cancel.onClick.AddListener(Cancel);
                view.me.coin.onEndEdit.AddListener(t =>
                {
                    if (State == null || State.youLocked) return;
                    var coin = (int)Math.Min(int.MaxValue, Math.Min(long.TryParse(t, out var c) ? c : 0, fishing.Bag?.coin ?? 0));
                    if (coin != MyCoin) SendSide(MyItems, MyStacks, coin);
                });
                foreach (var slot in view.me.slots)
                {
                    slot.Clicked = RemoveFromSlot;
                    slot.Hovered = Hover;
                    slot.Left = _ => Popup?.HideTooltip();
                }
                foreach (var slot in view.them.slots)
                {
                    slot.Hovered = Hover;
                    slot.Left = _ => Popup?.HideTooltip();
                }
            }
            if (invite == null && (invite = ui.Spawn<InviteView>("TradeInvite")) != null)
            {
                invite.accept.onClick.AddListener(() => Reply(true));
                invite.decline.onClick.AddListener(() => Reply(false));
                invite.root.SetActive(false);
            }
            if (count == null && (count = ui.Spawn<CountView>("Count")) != null) count.Close();
            return view != null && invite != null && count != null;
        }

        /// <summary>Screen point over my side of the open trade window: a bag item dropped here goes in.</summary>
        public bool OverMySide(Vector2 screen) =>
            Active && view != null && RectTransformUtility.RectangleContainsScreenPoint((RectTransform)view.me.back.transform, screen, null);

        /// <summary>From the bag (drop or click): Float items go straight in, stacks ask how many.</summary>
        public void Offer(ItemInstance item)
        {
            if (!Active || State.youLocked || item == null || item.locked) return;
            AddItem(item.instanceId);
        }

        public void Offer(ItemStack stack)
        {
            if (!Active || State.youLocked || stack == null || !Ensure()) return;
            MyStacks.TryGetValue(stack.defId, out var used);
            var free = stack.count - used;
            if (free <= 0) return;
            if (free == 1)
            {
                ChangeStack(stack.defId, 1, stack.count);
                return;
            }
            count.Ask(Loc.T("trade.how_many", ("item", FishingController.ItemName(stack.defId)), ("count", free)), free, free, n => ChangeStack(stack.defId, n, stack.count));
            count.transform.SetAsLastSibling();
        }

        void RemoveFromSlot(SlotView slot)
        {
            if (State == null || State.youLocked) return;
            if (slot.Data is ItemInstance it) RemoveItem(it.instanceId);
            else if (slot.Data is ItemStack st) ChangeStack(st.defId, -st.count, st.count);
        }

        void Hover(SlotView slot)
        {
            if (Popup == null || slot.Data == null) return;
            switch (slot.Data)
            {
                case ItemInstance it:
                    Popup.ShowTooltip(ItemText.Card(it, prices()));
                    break;
                case ItemStack st:
                    Popup.ShowTooltip(ItemText.Card(st));
                    break;
            }
        }

        public void Tick()
        {
            if (!Ensure()) return;

            // Invite box.
            var inviteLeft = Invite == null ? 0f : Invite.expiresInMs / 1000f - (Time.time - inviteAt);
            if (Invite != null && inviteLeft <= 0f) Invite = null;
            if (invite.root.activeSelf != (Invite != null))
            {
                invite.root.SetActive(Invite != null);
                if (Invite != null) invite.transform.SetAsLastSibling();
            }
            if (Invite != null)
            {
                invite.title.text = Loc.T("trade.invite_title", ("name", Invite.name));
                var d = DistanceTo?.Invoke(Invite.from);
                invite.sub.text = d.HasValue ? Loc.T("trade.invite_distance", ("tiles", d.Value.ToString("0"))) : "";
                HudView.Fill(invite.timer, Invite.expiresInMs > 0 ? inviteLeft * 1000f / Invite.expiresInMs : 0f);
                invite.caption.text = Loc.T("trade.invite_timeout", ("seconds", Mathf.CeilToInt(inviteLeft)));
            }

            // Trade window.
            if (view.window.Open != Active)
            {
                view.window.Open = Active;
                if (!Active) count.Close();
                dirty = true;
            }
            if (!Active) return;
            if (dirty && !view.me.coin.isFocused) Redraw();

            var s = State;
            var bothLocked = s.youLocked && s.themLocked;
            var left = ConfirmLeft(s);
            var ready = bothLocked && left <= 0f && !s.youConfirmed;
            view.confirm.interactable = ready;
            var label = s.youConfirmed ? Loc.T("trade.confirmed") : bothLocked && left > 0f ? Loc.T("trade.confirm_in", ("seconds", Mathf.CeilToInt(left))) : Loc.T("trade.confirm");
            if (view.confirmText.text != label) view.confirmText.text = label;
            view.strip.SetActive(bothLocked);
            view.hint.gameObject.SetActive(!bothLocked);
            if (bothLocked)
            {
                var strip = s.youConfirmed && !s.themConfirmed ? Loc.T("trade.strip_you_confirmed")
                    : s.themConfirmed && !s.youConfirmed ? Loc.T("trade.strip_they_confirmed")
                    : left > 0f ? Loc.T("trade.strip_wait", ("seconds", Mathf.CeilToInt(left))) : Loc.T("trade.strip_ready");
                if (view.stripText.text != strip) view.stripText.text = strip;
            }
        }

        float ConfirmLeft(TradeStateMsg s) => s.confirmInMs < 0 ? 0f : s.confirmInMs / 1000f - (Time.time - stateAt);

        void Redraw()
        {
            dirty = false;
            var s = State;
            view.window.title.text = Loc.T("trade.title", ("name", s.withName));
            DrawSide(view.me, s.you, Loc.T("trade.you"), "", s.youLocked, s.youConfirmed);
            DrawSide(view.them, s.them, s.withName, "", s.themLocked, s.themConfirmed);
            view.me.coin.SetTextWithoutNotify((s.you?.coin ?? 0).ToString());
            view.them.coin.SetTextWithoutNotify(Kit.Num(s.them?.coin ?? 0));
            view.me.coin.interactable = !s.youLocked;
            view.lockText.text = Loc.T(s.youLocked ? "bag.unlock" : "bag.lock");
        }

        void DrawSide(TradeView.Side side, TradeOfferView offer, string name, string level, bool locked, bool confirmed)
        {
            side.name.text = name;
            side.level.text = level;
            side.back.sprite = locked ? view.locked : view.open;
            var entries = new List<object>();
            entries.AddRange(offer?.items ?? Array.Empty<ItemInstance>());
            entries.AddRange(offer?.stacks ?? Array.Empty<ItemStack>());
            for (var i = 0; i < side.slots.Length; i++)
            {
                var slot = side.slots[i];
                if (i >= entries.Count) slot.SetEmpty();
                else if (entries[i] is ItemInstance it) slot.SetItem(it, false);
                else if (entries[i] is ItemStack st) slot.SetItem(st.defId, "", st.count, false);
                slot.Data = i < entries.Count ? entries[i] : null;
            }
            side.count.text = Loc.T("trade.side_count", ("count", entries.Count), ("max", side.slots.Length));
            side.status.text = Loc.T(confirmed ? "trade.side_confirmed" : locked ? "trade.side_locked" : "trade.side_preparing");
            side.status.color = confirmed ? Green : locked ? Brown : Faint;
        }
    }
}
