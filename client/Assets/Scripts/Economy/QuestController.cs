using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
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
        readonly KitWindow window = new KitWindow("Günlük görevler", 460, 330);

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
        }

        bool ClaimPending => Time.time - claimSentAt < 3f;

        // ---------- server ----------

        public void OnState(QuestStateMsg m)
        {
            var wasComplete = State != null && State.day == m.day && State.complete;
            State = m;
            stateAt = Time.time;
            if (m.complete && !m.claimed && !wasComplete) Toasts.Show("Günlük görevler bitti: sandığın hazır (G)");
        }

        public void OnClaimResult(QuestClaimResultMsg r)
        {
            LastClaim = r;
            claimSentAt = -10f;
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

        // ---------- UI ----------

        public void DrawGui()
        {
            if (!Open) return;
            if (!window.Begin())
            {
                window.End();
                Open = false;
                return;
            }
            var s = State;
            if (s == null)
            {
                GUILayout.Label("Görevler yükleniyor...", Kit.Text);
                window.End();
                return;
            }

            var left = Mathf.Max(0f, s.resetInMs / 1000f - (Time.time - stateAt));
            GUILayout.BeginHorizontal();
            GUILayout.Label("Bugünün görevleri", Kit.Header);
            GUILayout.FlexibleSpace();
            GUILayout.Label($"Yenilenmeye {(int)(left / 3600)} sa {(int)(left % 3600 / 60)} dk", Kit.Faint);
            GUILayout.EndHorizontal();

            foreach (var q in s.quests ?? Array.Empty<QuestProgress>())
            {
                GUILayout.BeginVertical(Kit.Card);
                GUILayout.BeginHorizontal();
                GUILayout.Label(Describe(q), Kit.Bold);
                GUILayout.FlexibleSpace();
                GUILayout.Label($"{q.progress} / {q.target}", q.progress >= q.target ? Kit.Good : Kit.Text);
                GUILayout.EndHorizontal();
                Bar(q.target > 0 ? Mathf.Clamp01((float)q.progress / q.target) : 0f);
                GUILayout.EndVertical();
            }

            GUILayout.FlexibleSpace();
            GUILayout.Label($"Seri: {s.streak} gün · bugünün sandığı {s.chestDay}. gün sandığı (10. gün en iyisi). Bir gün kaçırırsan seri biraz geri düşer.", Kit.Faint);
            GUILayout.BeginHorizontal();
            GUILayout.FlexibleSpace();
            GUI.enabled = s.complete && !s.claimed && !ClaimPending;
            var quests = s.quests ?? Array.Empty<QuestProgress>();
            var label = s.claimed ? "Sandık alındı" : s.complete ? "Sandığı aç" : $"{quests.Count(q => q.progress >= q.target)} / {quests.Length} bitti";
            if (GUILayout.Button(label, Kit.Green, GUILayout.Width(150), GUILayout.Height(28))) Claim();
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            window.End();
        }

        static void Bar(float fill)
        {
            var r = GUILayoutUtility.GetRect(100f, 10f, GUILayout.ExpandWidth(true));
            var back = Art.ArtCatalog.Ui("bar_back");
            var front = Art.ArtCatalog.Ui(fill >= 1f ? "bar_fill_green" : "bar_fill_yellow");
            if (back == null || front == null)
            {
                GUI.Box(r, GUIContent.none);
                GUI.Box(new Rect(r.x, r.y, r.width * fill, r.height), GUIContent.none, Gui.Fill);
                return;
            }
            GUI.DrawTexture(r, back, ScaleMode.StretchToFill);
            if (fill > 0f) GUI.DrawTexture(new Rect(r.x + 1, r.y + 1, (r.width - 2) * fill, r.height - 2), front, ScaleMode.StretchToFill);
        }
    }
}
