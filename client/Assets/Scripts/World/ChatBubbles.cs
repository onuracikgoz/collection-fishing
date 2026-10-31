using System.Collections.Generic;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.World
{
    /// <summary>
    /// Chat bubbles over the characters (31.10.2026, Onur): uGUI on a canvas under the windows, one
    /// stack per character. The newest bubble is at the bottom with the tail pointing at the speaker;
    /// older ones slide up when a new one comes, at most <see cref="CharacterView.MaxBubbles"/>.
    /// The stack sits on <see cref="CharacterView.BubbleAnchor"/> (above the name), set by WorldController.
    /// </summary>
    public sealed class ChatBubbles
    {
        const float Gap = 4f;
        const float Slide = 14f;  // per second, how fast a bubble reaches its place
        const float FadeOut = 0.4f;

        sealed class Shown
        {
            public CharacterView.BubbleLine Line;
            public BubbleView View;
            public float Y;
        }

        readonly Canvas canvas;
        readonly CanvasScaler scaler;
        readonly RectTransform root;
        readonly GameObject prefab;
        readonly Dictionary<CharacterView, List<Shown>> stacks = new Dictionary<CharacterView, List<Shown>>();
        readonly List<CharacterView> gone = new List<CharacterView>();

        public ChatBubbles()
        {
            var go = new GameObject("Bubbles", typeof(RectTransform));
            Object.DontDestroyOnLoad(go);
            canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = -10; // under every window
            canvas.pixelPerfect = true;
            scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
            scaler.referencePixelsPerUnit = UiRoot.PixelsPerUnit;
            root = (RectTransform)go.transform;
            prefab = Resources.Load<GameObject>("UI/Bubble");
            if (prefab == null) Debug.LogError("[UI] Missing prefab Resources/UI/Bubble (CollectionGame > UI > Build Prefabs)");
        }

        public void Destroy()
        {
            if (canvas != null) Object.Destroy(canvas.gameObject);
        }

        /// <summary>Call every frame after the labels were placed, with every character on screen.</summary>
        public void Tick(IEnumerable<CharacterView> views)
        {
            if (prefab == null) return;
            var scale = UiRoot.ScaleFor(Screen.width, Screen.height);
            scaler.scaleFactor = scale;
            canvas.scaleFactor = scale;
            var show = ClientSettings.Bubbles;
            var now = Time.time;
            var seen = new HashSet<CharacterView>();
            foreach (var who in views)
            {
                if (who == null) continue;
                seen.Add(who);
                Sync(who, show ? who.Bubbles : null, now, scale);
            }
            gone.Clear();
            foreach (var who in stacks.Keys)
                if (who == null || !seen.Contains(who)) gone.Add(who);
            foreach (var who in gone)
            {
                foreach (var s in stacks[who]) Object.Destroy(s.View.gameObject);
                stacks.Remove(who);
            }
        }

        void Sync(CharacterView who, List<CharacterView.BubbleLine> lines, float now, float scale)
        {
            if (!stacks.TryGetValue(who, out var stack)) stacks[who] = stack = new List<Shown>();
            // Drop bubbles whose line has expired or was pushed out of the character's list.
            for (var i = stack.Count - 1; i >= 0; i--)
            {
                var s = stack[i];
                if (lines != null && lines.Contains(s.Line) && now < s.Line.Until) continue;
                Object.Destroy(s.View.gameObject);
                stack.RemoveAt(i);
            }
            if (lines == null) return;
            foreach (var line in lines)
            {
                if (now >= line.Until || stack.Exists(s => s.Line == line)) continue;
                var view = Object.Instantiate(prefab, root, false).GetComponent<BubbleView>();
                view.Set(line.Text);
                stack.Add(new Shown { Line = line, View = view, Y = -6f });
            }
            if (stack.Count == 0) return;

            // Newest at the bottom (y 0), each older one above the one after it.
            var anchor = who.BubbleAnchor / scale;
            var target = 0f;
            var dt = Time.deltaTime;
            for (var i = stack.Count - 1; i >= 0; i--)
            {
                var s = stack[i];
                s.Y = Mathf.Abs(s.Y - target) < 0.5f ? target : Mathf.Lerp(s.Y, target, Mathf.Min(1f, dt * Slide));
                var rt = s.View.rect;
                rt.anchoredPosition = new Vector2(Mathf.Round(anchor.x), Mathf.Round(anchor.y + s.Y));
                s.View.tail.SetActive(i == stack.Count - 1);
                var left = s.Line.Until - now;
                s.View.fade.alpha = Mathf.Clamp01(left / FadeOut) * Mathf.Clamp01((now - s.Line.Born) / 0.15f + 0.3f);
                target += rt.sizeDelta.y + Gap;
            }
        }
    }
}
