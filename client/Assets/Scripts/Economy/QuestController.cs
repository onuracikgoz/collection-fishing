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
            fishing.BagChanged += () => dirty = true;
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
            Toasts.Money($"{r.chestDay}. gün sandığı açıldı", string.Join(", ", parts));
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

        // ---------- UI (uGUI: Resources/UI/Quests, draft npc-gorev) ----------

        QuestView view;
        bool dirty = true;
        int shownSecond = -1;

        QuestView View
        {
            get
            {
                if (view != null) return view;
                view = UiRoot.Get().Spawn<QuestView>("Quests");
                if (view != null)
                {
                    view.window.Closed = () => Open = false;
                    view.window.Open = false;
                    view.chest.button.onClick.AddListener(Claim);
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
            if (v.window.Open != Open)
            {
                v.window.Open = Open;
                dirty = true;
            }
            if (!Open) return;
            if (dirty) Redraw(v);
            var s = State;
            if (s == null) return;
            var left = Mathf.Max(0f, s.resetInMs / 1000f - (Time.time - stateAt));
            var sec = (int)left;
            if (sec / 60 == shownSecond / 60 && shownSecond >= 0) return;
            shownSecond = sec;
            v.hint.text = $"Yenilenmeye {sec / 3600} sa {sec % 3600 / 60} dk · seri {s.streak} gün";
        }

        /// <summary>A short word on the quest icon until quest icons exist.</summary>
        static string IconWord(string e) => e == "catch" || e == "catch_tier" ? "balık" : e == "sell" ? "sat" : e == "craft" ? "craft" : e == "merge" ? "birleş" : e == "trade" ? "takas" : e == "emote" ? "emote" : "?";

        void Redraw(QuestView v)
        {
            dirty = false;
            shownSecond = -1;
            v.coin.text = Kit.Num(fishing.Bag?.coin ?? 0);
            v.diamond.text = Kit.Num(fishing.Bag?.dust ?? 0); // toz, as on the merchant tabs
            var s = State;
            var quests = s?.quests ?? Array.Empty<QuestProgress>();
            for (var i = 0; i < v.quests.Length; i++)
            {
                var row = v.quests[i];
                var q = i < quests.Length ? quests[i] : null;
                row.root.SetActive(q != null);
                if (q == null) continue;
                var done = q.progress >= q.target;
                row.icon.SetEmpty();
                row.icon.label.text = IconWord(q.@event);
                row.title.text = Describe(q);
                v.SetBar(row, q.target > 0 ? Mathf.Clamp01((float)q.progress / q.target) : 0f);
                row.count.text = $"{q.progress} / {q.target}";
                row.reward.text = "Ödül: günün sandığına sayılır";
                row.state.text = done ? "Bitti" : "";
            }
            if (s == null)
            {
                v.header.text = "Görevler yükleniyor...";
                v.chest.root.SetActive(false);
                return;
            }
            v.header.text = "Bugünün görevleri";
            v.chest.root.SetActive(true);
            v.chest.icon.SetEmpty();
            v.chest.icon.label.text = "sandık";
            var doneCount = quests.Count(q => q.progress >= q.target);
            v.chest.title.text = $"{s.chestDay}. gün sandığı";
            v.SetBar(v.chest, quests.Length > 0 ? (float)doneCount / quests.Length : 0f);
            v.chest.count.text = $"{doneCount} / {quests.Length}";
            v.chest.reward.text = "10. gün sandığı en iyisidir";
            v.chest.state.text = "";
            v.chest.button.interactable = s.complete && !s.claimed && !ClaimPending;
            v.chest.buttonText.text = s.claimed ? "Alındı" : "Sandığı aç";
        }
    }
}
