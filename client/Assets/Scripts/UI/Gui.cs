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

        public static GUIStyle Name, NameMe, Shadow, Bubble, Hud, Input, Title, Error, Button, Alert, Toast, Fill, Water, FishMark;

        // Styles hold a runtime texture; without a domain reload it is gone next Play.
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => Name = null;

        /// <summary>Call first in every OnGUI.</summary>
        public static void Begin()
        {
            GUI.matrix = Matrix4x4.Scale(new Vector3(Scale, Scale, 1f));
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
