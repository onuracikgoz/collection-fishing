using System;
using System.Collections.Generic;
using CollectionGame.UI.Views;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// Notifications (drafts bildirim-yigin, bildirim-ust; docs/tasarim/15-gorsel-stil.md, Bildirimler):
    /// a stack at the top right, newest on top, at most 4 boxes, the rest as "+N bildirim daha".
    /// Colour is the kind: red blocks and stays until clicked, yellow warns (5 s), gold is money or
    /// a reward (5 s), green is information (4 s). Hovering a box stops its timer, a click closes it.
    /// Also the rare-catch line at the top and the level-up window. Drawn by <see cref="Tick"/>.
    /// </summary>
    public static class Toasts
    {
        public enum Kind { Info, Warn, Money, Block }

        const int Visible = 4;
        const float AnnounceSeconds = 5f;
        const float LevelUpSeconds = 5f;

        sealed class Entry
        {
            public Kind Kind;
            public string Title, Sub, ActionLabel;
            public Action Action;
            public float Left, Total;
            public bool Hovered;
        }

        static readonly List<Entry> entries = new List<Entry>();
        static NoticesView view;
        static string announceTitle, announceSub, announceName;
        static int announceCount;
        static float announceUntil;
        static int levelUpLevel;
        static string[] levelUpUnlocks;
        static float levelUpUntil;
        static bool dirty;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics()
        {
            entries.Clear();
            view = null;
            announceUntil = levelUpUntil = 0f;
        }

        static float Seconds(Kind k) => k == Kind.Block ? float.PositiveInfinity : k == Kind.Info ? 4f : 5f;

        /// <summary>One-line note: information, or a warning when bad.</summary>
        public static void Show(string text, bool bad = false) => Notify(text, null, bad ? Kind.Warn : Kind.Info);

        /// <summary>Money or a reward (gold).</summary>
        public static void Money(string title, string sub = null) => Notify(title, sub, Kind.Money);

        public static void Notify(string title, string sub, Kind kind, string actionLabel = null, Action action = null)
        {
            if (string.IsNullOrEmpty(title)) return;
            Debug.Log($"[Toast] {kind} {title} {sub}");
            entries.RemoveAll(e => e.Title == title && e.Sub == sub);
            var t = Seconds(kind);
            entries.Insert(0, new Entry { Kind = kind, Title = title, Sub = sub, ActionLabel = actionLabel, Action = action, Left = t, Total = t });
            dirty = true;
        }

        /// <summary>A rare catch on this server (ANNOUNCE); the same player's catches in a row are counted.</summary>
        public static void Announce(string name, string what, string sub)
        {
            if (Time.time < announceUntil && name == announceName) announceCount++;
            else announceCount = 1;
            announceName = name;
            announceTitle = announceCount > 1
                ? $"<color=#91db69>{name}</color>  {announceCount} nadir av yakaladı!"
                : $"<color=#91db69>{name}</color>  {what} yakaladı!";
            announceSub = sub;
            announceUntil = Time.time + AnnounceSeconds;
            dirty = true;
        }

        /// <summary>"SEVİYE ATLADIN": closes by itself after a few seconds, the game does not stop.</summary>
        public static void LevelUp(int level, string[] unlocks)
        {
            levelUpLevel = level;
            levelUpUnlocks = unlocks ?? Array.Empty<string>();
            levelUpUntil = Time.time + LevelUpSeconds;
            dirty = true;
        }

        /// <summary>The old IMGUI drawing; the notices are uGUI now.</summary>
        public static void Draw() { }

        /// <summary>Call every frame while in the world.</summary>
        public static void Tick()
        {
            if (view == null)
            {
                view = UiRoot.Get().Spawn<NoticesView>("Notices");
                if (view == null) return;
                for (var i = 0; i < view.boxes.Length; i++)
                {
                    var index = i;
                    var b = view.boxes[i];
                    b.hover.Entered = () => SetHover(index, true);
                    b.hover.Exited = () => SetHover(index, false);
                    b.hover.Clicked = () => Close(index);
                    b.action.onClick.AddListener(() =>
                    {
                        if (index < entries.Count) entries[index].Action?.Invoke();
                        Close(index);
                    });
                }
                dirty = true;
            }
            view.transform.SetAsLastSibling();

            var dt = Time.deltaTime;
            for (var i = entries.Count - 1; i >= 0; i--)
            {
                var e = entries[i];
                if (i < Visible && !e.Hovered) e.Left -= dt;
                if (e.Left <= 0f)
                {
                    entries.RemoveAt(i);
                    dirty = true;
                }
            }
            if (dirty) Redraw();
            for (var i = 0; i < view.boxes.Length && i < entries.Count; i++)
            {
                var e = entries[i];
                var share = float.IsInfinity(e.Total) ? 1f : Mathf.Clamp01(e.Left / e.Total);
                view.boxes[i].timer.rectTransform.localScale = new Vector3(share, 1f, 1f);
            }

            var annOn = Time.time < announceUntil && ClientSettings.Announcements;
            if (view.announce.activeSelf != annOn) view.announce.SetActive(annOn);
            var lvOn = Time.time < levelUpUntil;
            if (view.levelUp.Open != lvOn) view.levelUp.Open = lvOn;
        }

        static readonly Color Red = new Color32(0xe8, 0x3b, 0x3b, 255);
        static readonly Color Yellow = new Color32(0xf9, 0xc2, 0x2b, 255);
        static readonly Color Gold = new Color32(0xf7, 0x96, 0x17, 255);
        static readonly Color Green = new Color32(0x92, 0xa9, 0x84, 255);
        static readonly Color Paper = new Color32(0xf2, 0xe8, 0xd0, 255);

        static Color ColourOf(Kind k) => k == Kind.Block ? Red : k == Kind.Warn ? Yellow : k == Kind.Money ? Gold : Green;

        static void Redraw()
        {
            dirty = false;
            for (var i = 0; i < view.boxes.Length; i++)
            {
                var b = view.boxes[i];
                var e = i < entries.Count ? entries[i] : null;
                b.root.gameObject.SetActive(e != null);
                if (e == null) continue;
                var c = ColourOf(e.Kind);
                b.icon.color = c;
                b.timer.color = c;
                b.title.text = e.Title;
                b.sub.text = e.Sub ?? "";
                b.sub.color = e.Kind == Kind.Block ? Red : Paper;
                ((RectTransform)b.title.transform).anchoredPosition = new Vector2(52, string.IsNullOrEmpty(e.Sub) ? -14 : -3);
                b.action.gameObject.SetActive(e.ActionLabel != null);
                if (e.ActionLabel != null) b.actionText.text = e.ActionLabel;
            }
            var hidden = entries.Count - view.boxes.Length;
            view.more.SetActive(hidden > 0);
            if (hidden > 0) view.moreText.text = $"+{hidden} bildirim daha";

            if (announceTitle != null)
            {
                view.announceTitle.text = announceTitle;
                view.announceSub.text = announceSub ?? "";
            }
            if (levelUpUnlocks != null)
            {
                view.level.text = $"Lv {levelUpLevel}";
                for (var i = 0; i < view.unlocks.Length; i++)
                {
                    var u = i < levelUpUnlocks.Length ? levelUpUnlocks[i] : null;
                    view.unlocks[i].SetActive(u != null);
                    if (u == null) continue;
                    var (title, sub) = UnlockText(u);
                    view.unlockTitles[i].text = title;
                    view.unlockSubs[i].text = sub;
                }
            }
        }

        /// <summary>Unlock ids from the server's XP config (protokol.md, XP ve level).</summary>
        static (string, string) UnlockText(string id)
        {
            switch (id)
            {
                case "trade": return ("Takas", "açıldı");
                case "market": return ("Pazar tezgahı", "açıldı");
                default: return (id, "açıldı");
            }
        }

        static void SetHover(int index, bool on)
        {
            if (index < entries.Count) entries[index].Hovered = on;
        }

        static void Close(int index)
        {
            if (index >= entries.Count) return;
            entries.RemoveAt(index);
            dirty = true;
        }
    }
}
