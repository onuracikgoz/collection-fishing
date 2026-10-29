using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Economy;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
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
        string coinText = "0";

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
            coinText = (m.you?.coin ?? 0).ToString();
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

        // ---------- UI (uGUI: Resources/UI/Trade and TradeInvite, PanelViews) ----------

        PanelView view, invite;
        bool dirty = true;
        UnityEngine.UI.Button confirmButton;

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
            if (invite != null) UnityEngine.Object.Destroy(invite.gameObject);
        }

        public void Tick()
        {
            if (view == null) view = Spawn("Trade", Cancel);
            if (invite == null) invite = Spawn("TradeInvite", () => Reply(false));
            if (view == null || invite == null) return;

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
            if (view.Open != Active)
            {
                view.Open = Active;
                dirty = true;
            }
            if (!Active) return;
            if (dirty) Redraw(view);
            if (confirmButton != null)
            {
                var s = State;
                var left = ConfirmLeft(s);
                confirmButton.interactable = s.youLocked && s.themLocked && left <= 0f && !s.youConfirmed;
                var label = s.youConfirmed ? "Onaylandı" : s.youLocked && s.themLocked && left > 0f ? $"Onayla ({Mathf.CeilToInt(left)})" : "Onayla";
                var text = confirmButton.GetComponentInChildren<UnityEngine.UI.Text>();
                if (text.text != label) text.text = label;
            }
        }

        void Redraw(PanelView v)
        {
            dirty = false;
            var s = State;
            v.window.title.text = $"Takas: {s.withName}";
            v.header.text = Status(s);
            v.headerRight.text = $"{Kit.Num(fishing.Bag?.coin ?? 0)} Coin";
            v.ClearRows();
            v.ClearFooter();
            v.ColumnTitle(1, s.youLocked ? "Sen (kilitli)" : "Sen");
            v.ColumnTitle(2, s.themLocked ? $"{s.withName} (kilitli)" : s.withName);
            DrawBag(v, s);
            DrawSide(v, 1, s.you, true, s.youLocked);
            DrawSide(v, 2, s.them, false, true);
            v.Line($"Coin: {Kit.Num(s.you?.coin ?? 0)}", 1, false);
            v.Line($"Coin: {Kit.Num(s.them?.coin ?? 0)}", 2, false);
            v.footer.text = "Kilitli eşya ve toz takasa konamaz. Bir şey değişirse iki kilit de açılır.";

            v.FooterInput(coinText, 90, t => coinText = t, 10, true, "Coin");
            v.FooterButton("Coin koy", "wood", s.youLocked ? (Action)null : () =>
            {
                var coin = (int)Math.Min(int.MaxValue, Math.Min(long.TryParse(coinText, out var c) ? c : 0, fishing.Bag?.coin ?? 0));
                SendSide(MyItems, MyStacks, coin);
            }, 90);
            v.FooterSpace();
            v.FooterButton(s.youLocked ? "Kilidi aç" : "Kilitle", "wood", () => net.Send(OpCode.TradeLock, new TradeLockMsg { locked = !s.youLocked }));
            confirmButton = v.FooterButton("Onayla", "green", () => net.Send(OpCode.TradeConfirm, new EmptyMsg()));
            v.FooterButton("İptal", "red", Cancel, 80);
        }

        float ConfirmLeft(TradeStateMsg s) => s.confirmInMs < 0 ? 0f : s.confirmInMs / 1000f - (Time.time - stateAt);

        static string Status(TradeStateMsg s)
        {
            if (s.youConfirmed && !s.themConfirmed) return "Onayladın. Karşı tarafın onayı bekleniyor.";
            if (s.themConfirmed && !s.youConfirmed) return "Karşı taraf onayladı.";
            if (s.youLocked && s.themLocked) return "İkiniz de kilitlediniz: geri sayımdan sonra Onayla.";
            if (s.youLocked) return "Kilitledin. Karşı tarafın kilidi bekleniyor.";
            return "Çantadan eşya ekle, sonra Kilitle.";
        }

        void DrawBag(PanelView v, TradeStateMsg s)
        {
            var bag = fishing.Bag;
            if (bag == null)
            {
                v.Line("Yükleniyor...");
                return;
            }
            var offered = new HashSet<string>(MyItems);
            var stacks = MyStacks;
            var p = prices();
            foreach (var it in (bag.items ?? Array.Empty<ItemInstance>()).Where(i => !offered.Contains(i.instanceId))
                         .OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId))
            {
                var id = it.instanceId;
                v.Row().Mark(it.defId, it.tier, 1, it.locked).Title(FishingController.ItemName(it.defId)).Sub(ItemText.Short(it, p))
                    .Button("+", "wood", s.youLocked || it.locked ? (Action)null : () => AddItem(id), 26);
            }
            foreach (var st in bag.stacks ?? Array.Empty<ItemStack>())
            {
                stacks.TryGetValue(st.defId, out var used);
                var free = st.count - used;
                if (free <= 0) continue;
                var def = st.defId;
                var total = st.count;
                var row = v.Row().Mark(def, "", free).Title(FishingController.ItemName(def)).Sub($"{free} adet");
                row.Button("+1", "wood", s.youLocked ? (Action)null : () => ChangeStack(def, 1, total), 30);
                row.Button("Hepsi", "wood", s.youLocked ? (Action)null : () => ChangeStack(def, free, total), 50);
            }
        }

        void DrawSide(PanelView v, int column, TradeOfferView side, bool mine, bool locked)
        {
            var p = prices();
            var any = false;
            foreach (var it in side?.items ?? Array.Empty<ItemInstance>())
            {
                any = true;
                var id = it.instanceId;
                var row = v.Row(column).Mark(it.defId, it.tier).Title(FishingController.ItemName(it.defId)).Sub($"{ItemText.Short(it, p)} · Float {it.@float:0.0000}");
                if (mine && !locked) row.Button("-", "red", () => RemoveItem(id), 24);
            }
            foreach (var st in side?.stacks ?? Array.Empty<ItemStack>())
            {
                any = true;
                var def = st.defId;
                var count = st.count;
                var row = v.Row(column).Mark(def, "", count).Title(FishingController.ItemName(def)).Sub($"{count} adet");
                if (mine && !locked)
                {
                    row.Button("-1", "red", () => ChangeStack(def, -1, count), 28);
                    row.Button("x", "red", () => ChangeStack(def, -count, count), 24);
                }
            }
            if (!any) v.Line("Boş", column);
        }
    }
}
