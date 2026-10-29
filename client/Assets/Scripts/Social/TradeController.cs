using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Economy;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
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
        readonly KitWindow window = new KitWindow("Takas", 660, 420);

        public TradeInviteMsg Invite { get; private set; }
        public TradeStateMsg State { get; private set; }
        public TradeEndMsg LastEnd { get; private set; }
        /// <summary>A traded item that went to the book, shaped like FISH_END for the book banners.</summary>
        public Action<FishEndMsg> BookOutcome { get; set; }

        /// <summary>The window is open: the server ignores MOVE and CAST, so the client does not send them.</summary>
        public bool Active => State != null;

        float inviteAt, stateAt;
        string coinText = "0";
        Vector2 bagScroll, mineScroll, theirScroll;

        public TradeController(Connection net, FishingController fishing, Func<Prices> prices)
        {
            this.net = net;
            this.fishing = fishing;
            this.prices = prices;
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
            window.Title = $"Takas: {m.withName}";
            if (opening)
            {
                window.Center();
                fishing.RefreshBag();
            }
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

        // ---------- UI ----------

        public void DrawGui()
        {
            if (Invite != null) DrawInvite();
            if (State != null) DrawWindow();
        }

        void DrawInvite()
        {
            var left = Invite.expiresInMs / 1000f - (Time.time - inviteAt);
            if (left <= 0f)
            {
                Invite = null;
                return;
            }
            Kit.Begin();
            var r = new Rect((Gui.Width - 300f) / 2f, 70f, 300f, 74f);
            Gui.Block(r);
            GUILayout.BeginArea(r, Kit.Dark);
            GUILayout.Label($"{Invite.name} sana takas teklif ediyor ({Mathf.CeilToInt(left)})", Kit.Light);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Kabul", Kit.Green, GUILayout.Height(24))) Reply(true);
            if (GUILayout.Button("Reddet", Kit.Red, GUILayout.Height(24))) Reply(false);
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        void DrawWindow()
        {
            var s = State;
            if (!window.Begin())
            {
                window.End();
                Cancel();
                return;
            }

            GUILayout.BeginHorizontal();
            // Bag: what I can still add.
            GUILayout.BeginVertical(GUILayout.Width(220));
            GUILayout.Label($"Çanta  ·  {Kit.Num(fishing.Bag?.coin ?? 0)} Coin", Kit.Header);
            bagScroll = GUILayout.BeginScrollView(bagScroll);
            DrawBag(s);
            GUILayout.EndScrollView();
            GUILayout.EndVertical();

            GUILayout.Space(8);
            GUILayout.BeginVertical(GUILayout.Width(190));
            GUILayout.Label(s.youLocked ? "Sen  (kilitli)" : "Sen", s.youLocked ? Kit.Good : Kit.Header);
            mineScroll = GUILayout.BeginScrollView(mineScroll, GUILayout.Height(220));
            DrawSide(s.you, true, s.youLocked);
            GUILayout.EndScrollView();
            GUILayout.BeginHorizontal();
            GUILayout.Label("Coin", Kit.Text, GUILayout.Width(34));
            GUI.enabled = !s.youLocked;
            coinText = GUILayout.TextField(coinText, 10, Kit.Input, GUILayout.Width(80), GUILayout.Height(22));
            coinText = new string(coinText.Where(char.IsDigit).ToArray());
            if (GUILayout.Button("Koy", Kit.Wood, GUILayout.Height(22)))
            {
                var coin = (int)Math.Min(int.MaxValue, Math.Min(long.TryParse(coinText, out var c) ? c : 0, fishing.Bag?.coin ?? 0));
                SendSide(MyItems, MyStacks, coin);
            }
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            GUILayout.EndVertical();

            GUILayout.Space(8);
            GUILayout.BeginVertical();
            GUILayout.Label(s.themLocked ? $"{s.withName}  (kilitli)" : s.withName, s.themLocked ? Kit.Good : Kit.Header);
            theirScroll = GUILayout.BeginScrollView(theirScroll, GUILayout.Height(220));
            DrawSide(s.them, false, true);
            GUILayout.EndScrollView();
            GUILayout.Label($"Coin: {Kit.Num(s.them?.coin ?? 0)}", Kit.Bold);
            GUILayout.EndVertical();
            GUILayout.EndHorizontal();

            GUILayout.FlexibleSpace();
            GUILayout.Label(Status(s), Kit.Faint);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button(s.youLocked ? "Kilidi aç" : "Kilitle", Kit.Wood, GUILayout.Height(26)))
                net.Send(OpCode.TradeLock, new TradeLockMsg { locked = !s.youLocked });
            var left = ConfirmLeft(s);
            GUI.enabled = s.youLocked && s.themLocked && left <= 0f && !s.youConfirmed;
            var label = s.youConfirmed ? "Onaylandı" : s.youLocked && s.themLocked && left > 0f ? $"Onayla ({Mathf.CeilToInt(left)})" : "Onayla";
            if (GUILayout.Button(label, Kit.Green, GUILayout.Height(26))) net.Send(OpCode.TradeConfirm, new EmptyMsg());
            GUI.enabled = true;
            if (GUILayout.Button("İptal", Kit.Red, GUILayout.Height(26))) Cancel();
            GUILayout.EndHorizontal();
            window.End();
        }

        float ConfirmLeft(TradeStateMsg s) => s.confirmInMs < 0 ? 0f : s.confirmInMs / 1000f - (Time.time - stateAt);

        static string Status(TradeStateMsg s)
        {
            if (s.youConfirmed && !s.themConfirmed) return "Onayladın. Karşı tarafın onayı bekleniyor.";
            if (s.themConfirmed && !s.youConfirmed) return "Karşı taraf onayladı.";
            if (s.youLocked && s.themLocked) return "İkiniz de kilitlediniz. Geri sayımdan sonra Onayla'ya bas. Bir şey değişirse kilitler açılır.";
            if (s.youLocked) return "Kilitledin. Karşı tarafın kilidi bekleniyor.";
            return "Çantadan eşya ekle, sonra Kilitle. Bir şey değişirse kilitler açılır.";
        }

        void DrawBag(TradeStateMsg s)
        {
            var bag = fishing.Bag;
            if (bag == null)
            {
                GUILayout.Label("Yükleniyor...", Kit.Faint);
                return;
            }
            var offered = new HashSet<string>(MyItems);
            var stacks = MyStacks;
            var p = prices();
            GUI.enabled = !s.youLocked;
            foreach (var it in (bag.items ?? Array.Empty<ItemInstance>()).Where(i => !offered.Contains(i.instanceId))
                         .OrderBy(i => Tiers.Rank(i.tier)).ThenBy(i => i.defId))
            {
                GUILayout.BeginHorizontal(Kit.Card);
                Kit.TierMark(it.tier, it.locked ? "kilit" : "");
                GUILayout.Label(ItemText.Short(it, p), Kit.Small);
                var was = GUI.enabled;
                GUI.enabled = was && !it.locked;
                if (GUILayout.Button("+", Kit.Wood, GUILayout.Width(26), GUILayout.Height(20))) AddItem(it.instanceId);
                GUI.enabled = was;
                GUILayout.EndHorizontal();
            }
            foreach (var st in bag.stacks ?? Array.Empty<ItemStack>())
            {
                stacks.TryGetValue(st.defId, out var used);
                var free = st.count - used;
                if (free <= 0) continue;
                GUILayout.BeginHorizontal(Kit.Card);
                Kit.TierMark(null);
                GUILayout.Label($"{FishingController.ItemName(st.defId)} x{free}", Kit.Small);
                if (GUILayout.Button("+1", Kit.Wood, GUILayout.Width(30), GUILayout.Height(20))) ChangeStack(st.defId, 1, st.count);
                if (GUILayout.Button("Hepsi", Kit.Wood, GUILayout.Width(46), GUILayout.Height(20))) ChangeStack(st.defId, free, st.count);
                GUILayout.EndHorizontal();
            }
            GUI.enabled = true;
            GUILayout.Label("Kilitli eşya ve toz takasa konamaz.", Kit.Faint);
        }

        void DrawSide(TradeOfferView side, bool mine, bool locked)
        {
            var p = prices();
            var any = false;
            foreach (var it in side?.items ?? Array.Empty<ItemInstance>())
            {
                any = true;
                GUILayout.BeginHorizontal(Kit.Card);
                Kit.TierMark(it.tier);
                GUILayout.Label(ItemText.Long(it, p), Kit.Small);
                if (mine && !locked && GUILayout.Button("-", Kit.Red, GUILayout.Width(24), GUILayout.Height(20))) RemoveItem(it.instanceId);
                GUILayout.EndHorizontal();
            }
            foreach (var st in side?.stacks ?? Array.Empty<ItemStack>())
            {
                any = true;
                GUILayout.BeginHorizontal(Kit.Card);
                Kit.TierMark(null, st.count.ToString());
                GUILayout.Label(FishingController.ItemName(st.defId), Kit.Small);
                if (mine && !locked)
                {
                    if (GUILayout.Button("-1", Kit.Red, GUILayout.Width(28), GUILayout.Height(20))) ChangeStack(st.defId, -1, st.count);
                    if (GUILayout.Button("x", Kit.Red, GUILayout.Width(24), GUILayout.Height(20))) ChangeStack(st.defId, -st.count, st.count);
                }
                GUILayout.EndHorizontal();
            }
            if (!any) GUILayout.Label("Boş", Kit.Faint);
        }
    }
}
