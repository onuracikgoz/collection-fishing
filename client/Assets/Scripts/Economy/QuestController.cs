using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.Economy
{
    /// <summary>
    /// Daily quests (docs/protokol.md, Günlük görev; draft npc-gorev). The server counts every
    /// event and sends QUEST_STATE; the client only shows it and sends QUEST_CLAIM for the chest
    /// once all of them are done. G opens and closes the window.
    /// </summary>
    public sealed class QuestController
    {
        readonly Connection net;
        readonly FishingController fishing;

        public bool Open { get; set; }
        public QuestStateMsg State { get; private set; }
        public QuestClaimResultMsg LastClaim { get; private set; }

        float stateAt;
        float claimSentAt = -10f;

        public QuestController(Connection net, FishingController fishing)
        {
            this.net = net;
            this.fishing = fishing;
        }

        public void Update(bool typing)
        {
            var k = Keyboard.current;
            if (typing || k == null) return;
            if (k.gKey.wasPressedThisFrame) Open = !Open;
        }

        public void Claim()
        {
            claimSentAt = Time.time;
            net.Send(OpCode.QuestClaim, new EmptyMsg());
            dirty = true;
        }

        bool ClaimPending => Time.time - claimSentAt < 3f;

        // ---------- server ----------

        public void OnState(QuestStateMsg m)
        {
            var wasComplete = State != null && State.day == m.day && State.complete;
            State = m;
            stateAt = Time.time;
            dirty = true;
            shownSecond = -1;
            if (m.complete && !m.claimed && !wasComplete) Toasts.Show("Günlük görevler bitti: sandığın hazır (G)");
        }

        public void OnClaimResult(QuestClaimResultMsg r)
        {
            LastClaim = r;
            claimSentAt = -10f;
            dirty = true;
            Debug.Log($"[Quest] CLAIM ok {r.ok} {r.reason} day {r.chestDay}");
            if (!r.ok)
            {
                Toasts.Show(r.reason == "NOT_DONE" ? "Önce bütün görevleri bitir"
                    : r.reason == "ALREADY_CLAIMED" ? "Bugünün sandığını zaten aldın"
                    : r.reason == "BAG_FULL" ? "Çantada yer yok: yer açıp tekrar dene"
                    : $"Sandık açılamadı ({r.reason})", true);
                return;
            }
            var parts = new List<string>();
            foreach (var w in r.rewards ?? Array.Empty<QuestReward>())
                parts.Add(w.kind == "coin" ? $"{Kit.Num(w.count)} Coin" : w.kind == "dust" ? $"{w.count} toz" : $"{FishingController.ItemName(w.defId)} x{w.count}");
            Toasts.Show($"{r.chestDay}. gün sandığı: {string.Join(", ", parts)}");
            if (fishing.Bag != null)
            {
                fishing.Bag.coin = r.coin;
                fishing.Bag.dust = r.dust;
            }
            fishing.RefreshBag();
        }

        /// <summary>"5 balık tut", from the quest's event and target (ids look like catch_rare_1).</summary>
        public static string Describe(QuestProgress q)
        {
            switch (q.@event)
            {
                case "catch": return $"{q.target} balık tut";
                case "catch_tier":
                    var parts = (q.id ?? "").Split('_');
                    var tier = parts.Length >= 3 ? parts[1] : "";
                    return Tiers.Rank(tier) >= 0 ? $"{q.target} tane {tier} ya da üstü yakala" : $"{q.target} değerli av yakala";
                case "sell": return $"NPC'ye {q.target} şey sat";
                case "craft": return $"{q.target} kez craft yap";
                case "merge": return $"{q.target} kez birleştir";
                case "trade": return $"{q.target} takas tamamla";
                case "emote": return $"{q.target} emote yap";
                default: return q.id;
            }
        }

        // ---------- UI (uGUI: Resources/UI/Quests, a PanelView) ----------

        PanelView view;
        bool dirty = true;
        int shownSecond = -1;

        PanelView View
        {
            get
            {
                if (view != null) return view;
                view = UiRoot.Get().Spawn<PanelView>("Quests");
                if (view != null)
                {
                    view.window.Closed = () => Open = false;
                    view.Open = false;
                }
                return view;
            }
        }

        public void Destroy()
        {
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
        }

        /// <summary>Call every frame: follows Open and redraws after a change.</summary>
        public void Tick()
        {
            var v = View;
            if (v == null) return;
            if (v.Open != Open)
            {
                v.Open = Open;
                dirty = true;
            }
            if (!Open) return;
            if (dirty) Redraw(v);
            var s = State;
            if (s == null) return;
            var left = Mathf.Max(0f, s.resetInMs / 1000f - (Time.time - stateAt));
            var sec = (int)left;
            if (sec == shownSecond) return;
            shownSecond = sec;
            v.headerRight.text = $"Yenilenmeye {sec / 3600} sa {sec % 3600 / 60} dk";
        }

        void Redraw(PanelView v)
        {
            dirty = false;
            v.ClearRows();
            v.ClearFooter();
            var s = State;
            v.header.text = "Bugünün görevleri";
            if (s == null)
            {
                v.Line("Görevler yükleniyor...");
                return;
            }
            var quests = s.quests ?? Array.Empty<QuestProgress>();
            foreach (var q in quests)
            {
                var done = q.progress >= q.target;
                v.Row().Title(Describe(q)).Right($"{q.progress} / {q.target}", done ? new Color(0.12f, 0.44f, 0.31f) : (Color?)null)
                    .Bar(q.target > 0 ? Mathf.Clamp01((float)q.progress / q.target) : 0f);
            }
            v.footer.text = $"Seri: {s.streak} gün · bugünün sandığı {s.chestDay}. gün sandığı (10. gün en iyisi). Bir gün kaçırırsan seri biraz geri düşer.";
            v.FooterSpace();
            var label = s.claimed ? "Sandık alındı" : s.complete ? "Sandığı aç" : $"{quests.Count(q => q.progress >= q.target)} / {quests.Length} bitti";
            v.FooterButton(label, "green", s.complete && !s.claimed && !ClaimPending ? Claim : (Action)null, 160);
        }
    }
}
