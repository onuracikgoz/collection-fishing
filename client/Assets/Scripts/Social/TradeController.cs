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
            Toasts.Show($"Takas teklifi gönderildi: {name}");
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
                    Toasts.Show(parts.Count > 0 ? $"Takas tamam. Aldın: {string.Join(", ", parts)}" : "Takas tamam");
                    foreach (var b in m.book ?? Array.Empty<TradeBookResult>())
                    {
                        var item = got?.items?.FirstOrDefault(i => i.instanceId == b.instanceId);
                        if (item != null && !string.IsNullOrEmpty(b.page))
                            BookOutcome?.Invoke(new FishEndMsg { id = net.UserId, outcome = FishOutcome.Caught, defId = item.defId, item = item, book = b });
                    }
                    break;
                case "declined": Toasts.Show("Takas teklifi reddedildi"); break;
                case "expired": Toasts.Show("Takas teklifi cevapsız kaldı"); break;
                case "cancelled": Toasts.Show(string.IsNullOrEmpty(m.reason) ? "Takas iptal edildi" : EndReason(m), !string.IsNullOrEmpty(m.reason)); break;
                default: Toasts.Show(EndReason(m), true); break;
            }
            fishing.RefreshBag();
        }

        string EndReason(TradeEndMsg m)
        {
            switch (m.reason)
            {
                case "NOT_HERE": return "Oyuncu bu sunucuda değil";
                case "TOO_FAR": return "Çok uzaksınız, yanına git";
                case "BUSY": return "Oyuncu şu an başka bir takasta";
                case "SELF": return "Kendinle takas yapamazsın";
                case "RATE_LIMITED": return "Biraz bekle, sonra tekrar teklif et";
                case "TRADE_LOCKED": return "Hesabına yeni giriş yolu bağlandı: takas bir süre kapalı";
                case "TARGET_TRADE_LOCKED": return "Karşı tarafın hesabı şu an takasa kapalı";
                case "LEVEL_TOO_LOW": return "Takas için levelin yetmiyor";
                case "TARGET_LEVEL_TOO_LOW": return "Karşı tarafın leveli takas için yetmiyor";
                case "ITEM_GONE": return "Takas olmadı: bir eşya artık yok";
                case "NOT_ENOUGH": return "Takas olmadı: yığın ya da Coin yetmiyor";
                case "BAG_FULL": return m.userId == net.UserId ? "Takas olmadı: çantan dolu" : "Takas olmadı: karşı tarafın çantası dolu";
                case null: case "": return "Takas olmadı";
                default: return $"Takas olmadı ({m.reason})";
            }
        }

        static string StateReason(string r)
        {
            switch (r)
            {
                case "TOO_MANY": return "Takasa daha fazla kalem konamaz";
                case "NOT_OWNED": return "Bu eşya çantanda değil";
                case "NOT_ENOUGH": return "O kadar yok";
                case "LOCKED": return "Kilitli eşya takasa konamaz";
                case "BAD_REQUEST": return "İstek geçersiz";
                default: return $"Olmadı ({r})";
            }
        }

        // ---------- UI (uGUI: Resources/UI/Trade after takas-a/b/c, TradeInvite, Count) ----------

        static readonly Color Brown = new Color32(0x7a, 0x30, 0x45, 255);
        static readonly Color Green = new Color32(0x1e, 0x6f, 0x50, 255);
        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);

        TradeView view;
        PanelView invite;
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
            if (invite == null && (invite = ui.Spawn<PanelView>("TradeInvite")) != null)
            {
                invite.window.Closed = () => Reply(false);
                invite.Open = false;
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
            count.Ask($"Kaç tane? ({FishingController.ItemName(stack.defId)}, {free} var)", free, free, n => ChangeStack(stack.defId, n, stack.count));
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
            var p = prices();
            switch (slot.Data)
            {
                case ItemInstance it:
                    var cond = p != null ? $" · {Prices.ConditionName(p.ConditionOf(it.@float))}" : "";
                    Popup.ShowTooltip($"<b>{FishingController.ItemName(it.defId)}</b>\n{it.tier}\nFloat {it.@float:0.0000}{cond}");
                    break;
                case ItemStack st:
                    Popup.ShowTooltip($"<b>{FishingController.ItemName(st.defId)}</b>\n{st.count} adet");
                    break;
            }
        }

        public void Tick()
        {
            if (!Ensure()) return;

            // Invite box.
            var inviteLeft = Invite == null ? 0f : Invite.expiresInMs / 1000f - (Time.time - inviteAt);
            if (Invite != null && inviteLeft <= 0f) Invite = null;
            if (invite.Open != (Invite != null))
            {
                invite.Open = Invite != null;
                if (Invite != null)
                {
                    invite.ClearFooter();
                    invite.FooterButton("Kabul", "green", () => Reply(true));
                    invite.FooterButton("Reddet", "red", () => Reply(false));
                }
            }
            if (Invite != null) invite.header.text = $"{Invite.name} sana takas teklif ediyor ({Mathf.CeilToInt(inviteLeft)})";

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
            var label = s.youConfirmed ? "Onaylandı" : bothLocked && left > 0f ? $"Onayla ({Mathf.CeilToInt(left)})" : "Onayla";
            if (view.confirmText.text != label) view.confirmText.text = label;
            view.strip.SetActive(bothLocked);
            view.hint.gameObject.SetActive(!bothLocked);
            if (bothLocked)
            {
                var strip = s.youConfirmed && !s.themConfirmed ? "Onayladın. Karşı tarafın onayı bekleniyor."
                    : s.themConfirmed && !s.youConfirmed ? "Karşı taraf onayladı."
                    : left > 0f ? $"İki taraf kilitledi. Onay {Mathf.CeilToInt(left)} sn sonra açılır" : "İki taraf kilitledi. Onaylayabilirsin.";
                if (view.stripText.text != strip) view.stripText.text = strip;
            }
        }

        float ConfirmLeft(TradeStateMsg s) => s.confirmInMs < 0 ? 0f : s.confirmInMs / 1000f - (Time.time - stateAt);

        void Redraw()
        {
            dirty = false;
            var s = State;
            view.window.title.text = $"Takas · {s.withName}";
            DrawSide(view.me, s.you, "Sen", "", s.youLocked, s.youConfirmed);
            DrawSide(view.them, s.them, s.withName, "", s.themLocked, s.themConfirmed);
            view.me.coin.SetTextWithoutNotify((s.you?.coin ?? 0).ToString());
            view.them.coin.SetTextWithoutNotify(Kit.Num(s.them?.coin ?? 0));
            view.me.coin.interactable = !s.youLocked;
            view.lockText.text = s.youLocked ? "Kilidi aç" : "Kilitle";
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
                else if (entries[i] is ItemInstance it) slot.SetItem(it.defId, it.tier, 1, false);
                else if (entries[i] is ItemStack st) slot.SetItem(st.defId, "", st.count, false);
                slot.Data = i < entries.Count ? entries[i] : null;
            }
            side.count.text = $"{entries.Count} / {side.slots.Length} eşya";
            side.status.text = confirmed ? "Onayladı" : locked ? "Kilitledi" : "Hazırlanıyor...";
            side.status.color = confirmed ? Green : locked ? Brown : Faint;
        }
    }
}
