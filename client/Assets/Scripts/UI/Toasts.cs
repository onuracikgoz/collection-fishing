using System.Collections.Generic;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// Short notes for the new windows (trade, market, quests, whisper, settings), stacked above
    /// the chat line, newest at the bottom, at most 4 (docs/tasarim/15-gorsel-stil.md, Bildirimler).
    /// </summary>
    public static class Toasts
    {
        const int Max = 4;
        const float Seconds = 4.5f;

        struct Entry
        {
            public string Text;
            public bool Bad;
            public float Until;
        }

        static readonly List<Entry> entries = new List<Entry>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => entries.Clear();

        public static void Show(string text, bool bad = false)
        {
            if (string.IsNullOrEmpty(text)) return;
            Debug.Log($"[Toast] {text}");
            entries.RemoveAll(e => e.Text == text);
            entries.Add(new Entry { Text = text, Bad = bad, Until = Time.time + Seconds });
            while (entries.Count > Max) entries.RemoveAt(0);
        }

        /// <summary>Call from OnGUI after <see cref="Gui.Begin"/>.</summary>
        public static void Draw()
        {
            entries.RemoveAll(e => Time.time > e.Until);
            var y = Gui.Height - Gui.CanvasToGui(190f);
            for (var i = entries.Count - 1; i >= 0; i--)
            {
                var e = entries[i];
                var size = Gui.Toast.CalcSize(new GUIContent(e.Text)) + new Vector2(24f, 10f);
                var old = GUI.color;
                if (e.Bad) GUI.color = new Color(1f, 0.82f, 0.8f);
                GUI.Box(new Rect((Gui.Width - size.x) / 2f, y - size.y, size.x, size.y), e.Text, Gui.Toast);
                GUI.color = old;
                y -= size.y + 4f;
            }
        }
    }
}
