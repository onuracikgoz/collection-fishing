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
            // No key: the quest giver NPC opens this window (World/NpcController).
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
            if (m.complete && !m.claimed && !wasComplete) Toasts.Show(Loc.T("quest.all_done"));
        }

        public void OnClaimResult(QuestClaimResultMsg r)
        {
            LastClaim = r;
            claimSentAt = -10f;
            dirty = true;
            Debug.Log($"[Quest] CLAIM ok {r.ok} {r.reason} day {r.chestDay}");
            if (!r.ok)
            {
                Toasts.Show(Loc.Reason("quest", r.reason), true);
                return;
            }
            var parts = new List<string>();
            foreach (var w in r.rewards ?? Array.Empty<QuestReward>())
                parts.Add(w.kind == "coin" ? $"{Kit.Num(w.count)} Coin" : w.kind == "dust" ? Loc.T("common.dust_amount", ("amount", w.count)) : $"{FishingController.ItemName(w.defId)} x{w.count}");
            Toasts.Money(Loc.T("quest.chest_opened", ("day", r.chestDay)), string.Join(", ", parts));
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
                case "catch": return Loc.T("quest.desc.catch", ("count", q.target));
                case "catch_tier":
                    var parts = (q.id ?? "").Split('_');
                    var tier = parts.Length >= 3 ? parts[1] : "";
                    return Tiers.Rank(tier) >= 0 ? Loc.T("quest.desc.catch_tier", ("count", q.target), ("tier", tier)) : Loc.T("quest.desc.catch_valuable", ("count", q.target));
                case "sell": return Loc.T("quest.desc.sell", ("count", q.target));
                case "craft": return Loc.T("quest.desc.craft", ("count", q.target));
                case "merge": return Loc.T("quest.desc.merge", ("count", q.target));
                case "trade": return Loc.T("quest.desc.trade", ("count", q.target));
                case "emote": return Loc.T("quest.desc.emote", ("count", q.target));
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
        int locVersion;

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
            if (locVersion != Loc.Version)
            {
                locVersion = Loc.Version; // language changed: redraw the texts
                dirty = true;
            }
            if (dirty) Redraw(v);
            var s = State;
            if (s == null) return;
            var left = Mathf.Max(0f, s.resetInMs / 1000f - (Time.time - stateAt));
            var sec = (int)left;
            if (sec / 60 == shownSecond / 60 && shownSecond >= 0) return;
            shownSecond = sec;
            v.hint.text = Loc.T("quest.reset_in", ("hours", sec / 3600), ("minutes", sec % 3600 / 60), ("streak", s.streak));
        }

        /// <summary>A short word on the quest icon until quest icons exist.</summary>

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
                row.icon.SetIcon(q.@event);
                row.title.text = Describe(q);
                v.SetBar(row, q.target > 0 ? Mathf.Clamp01((float)q.progress / q.target) : 0f);
                row.count.text = $"{q.progress} / {q.target}";
                row.reward.text = Loc.T("quest.reward");
                row.state.text = done ? Loc.T("quest.done") : "";
            }
            if (s == null)
            {
                v.header.text = Loc.T("quest.loading");
                v.chest.root.SetActive(false);
                return;
            }
            v.header.text = Loc.T("quest.today");
            v.chest.root.SetActive(true);
            v.chest.icon.SetEmpty();
            v.chest.icon.SetIcon("chest");
            var doneCount = quests.Count(q => q.progress >= q.target);
            v.chest.title.text = Loc.T("quest.chest_title", ("day", s.chestDay));
            v.SetBar(v.chest, quests.Length > 0 ? (float)doneCount / quests.Length : 0f);
            v.chest.count.text = $"{doneCount} / {quests.Length}";
            v.chest.reward.text = Loc.T("quest.chest_best");
            v.chest.state.text = "";
            v.chest.button.interactable = s.complete && !s.claimed && !ClaimPending;
            v.chest.buttonText.text = Loc.T(s.claimed ? "quest.claimed" : "quest.open_chest");
        }
    }
}
