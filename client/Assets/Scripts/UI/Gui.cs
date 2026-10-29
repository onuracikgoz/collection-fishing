using System.Collections.Generic;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// Shared IMGUI setup for the Phase 1 screens: a scale so text is readable on
    /// Retina screens, and a few styles. Placeholder UI until real UI is designed.
    /// </summary>
    public static class Gui
    {
        const float ReferenceHeight = 720f;

        public static float Scale => Mathf.Max(1f, Screen.height / ReferenceHeight);
        public static float Width => Screen.width / Scale;
        public static float Height => Screen.height / Scale;

        /// <summary>uGUI canvas units (UiRoot, 1408x896 layout) in IMGUI units: keeps IMGUI text clear of the HUD bar.</summary>
        public static float CanvasToGui(float units) => units * UiRoot.ScaleFor(Screen.width, Screen.height) / Scale;

        public static GUIStyle HudBold;
        public static GUIStyle Name, NameMe, Shadow, Bubble, Hud, Input, Title, Error, Button, Alert, Toast, Fill, Water, FishMark, Header, Faint, Discover, Celebrate, Window, Emote, Warn, Good;

        // Styles hold a runtime texture; without a domain reload it is gone next Play.
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => Name = null;

        /// <summary>Call first in every OnGUI.</summary>
        public static void Begin()
        {
            GUI.matrix = Matrix4x4.Scale(new Vector3(Scale, Scale, 1f));
            if (Event.current.type == EventType.Layout) blockers.Clear();
            if (Name != null) return;

            Name = new GUIStyle(GUI.skin.label) { fontSize = 13, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            Name.normal.textColor = Color.white;
            NameMe = new GUIStyle(Name);
            NameMe.normal.textColor = new Color(1f, 0.92f, 0.5f);
            Shadow = new GUIStyle(Name);
            Shadow.normal.textColor = new Color(0f, 0f, 0f, 0.8f);

            Bubble = new GUIStyle(GUI.skin.box) { fontSize = 13, wordWrap = true, alignment = TextAnchor.MiddleCenter, padding = new RectOffset(8, 8, 5, 5) };
            Bubble.normal.textColor = new Color(0.1f, 0.1f, 0.12f);
            Bubble.normal.background = Solid(new Color(1f, 1f, 1f, 0.92f));

            Hud = new GUIStyle(GUI.skin.label) { fontSize = 14 };
            Hud.normal.textColor = Color.white;
            HudBold = new GUIStyle(Hud) { fontSize = 15, fontStyle = FontStyle.Bold };

            Input = new GUIStyle(GUI.skin.textField) { fontSize = 15, alignment = TextAnchor.MiddleLeft, padding = new RectOffset(8, 8, 4, 4) };
            Title = new GUIStyle(GUI.skin.label) { fontSize = 26, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
            Title.normal.textColor = Color.white;
            Error = new GUIStyle(GUI.skin.label) { fontSize = 14, wordWrap = true, alignment = TextAnchor.UpperCenter };
            Error.normal.textColor = new Color(1f, 0.55f, 0.5f);
            Button = new GUIStyle(GUI.skin.button) { fontSize = 15 };

            Alert = new GUIStyle(Hud) { fontSize = 22, fontStyle = FontStyle.Bold };
            Alert.normal.textColor = new Color(1f, 0.85f, 0.2f);
            Toast = new GUIStyle(Bubble) { fontSize = 15, wordWrap = false };
            Fill = Box(new Color(0.35f, 0.85f, 0.4f, 0.9f));
            Water = Box(new Color(0.15f, 0.35f, 0.55f, 0.9f));
            FishMark = Box(new Color(1f, 0.55f, 0.15f, 1f));

            Window = new GUIStyle(GUI.skin.box) { padding = new RectOffset(10, 10, 8, 8) };
            Window.normal.background = Solid(new Color(0.09f, 0.13f, 0.18f, 0.94f));
            Emote = new GUIStyle(Name) { fontStyle = FontStyle.Italic };
            Emote.normal.textColor = new Color(0.75f, 0.95f, 1f);
            Header = new GUIStyle(Hud) { fontSize = 17, fontStyle = FontStyle.Bold };
            Faint = new GUIStyle(Hud);
            Faint.normal.textColor = new Color(1f, 1f, 1f, 0.45f);
            Warn = new GUIStyle(Hud);
            Warn.normal.textColor = new Color(1f, 0.55f, 0.5f);
            Good = new GUIStyle(Hud);
            Good.normal.textColor = new Color(0.55f, 1f, 0.6f);
            Discover = new GUIStyle(Toast) { fontSize = 20, fontStyle = FontStyle.Bold, padding = new RectOffset(16, 16, 8, 8) };
            Discover.normal.background = Solid(new Color(1f, 0.95f, 0.7f, 0.95f));
            Celebrate = new GUIStyle(Discover) { fontSize = 28 };
            Celebrate.normal.background = Solid(new Color(1f, 0.8f, 0.3f, 0.97f));
        }

        static readonly List<Rect> blockers = new List<Rect>();

        /// <summary>Marks a window or button area (GUI coordinates) so clicks there do not walk.</summary>
        public static void Block(Rect r)
        {
            if (Event.current.type == EventType.Repaint) blockers.Add(r);
        }

        /// <summary>True if the screen point is over UI drawn last frame.</summary>
        public static bool IsOverUi(Vector2 screen)
        {
            var p = ToGui(screen);
            foreach (var r in blockers)
                if (r.Contains(p)) return true;
            return false;
        }

        /// <summary>Screen pixels (origin bottom-left) → scaled GUI coordinates (origin top-left).</summary>
        public static Vector2 ToGui(Vector3 screen) => new Vector2(screen.x / Scale, (Screen.height - screen.y) / Scale);

        static GUIStyle Box(Color c)
        {
            var style = new GUIStyle { border = new RectOffset(0, 0, 0, 0) };
            style.normal.background = Solid(c);
            return style;
        }

        static Texture2D Solid(Color c)
        {
            var t = new Texture2D(1, 1);
            t.SetPixel(0, 0, c);
            t.Apply();
            return t;
        }
    }
}
