using System.Collections.Generic;
using CollectionGame.Art;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// IMGUI styles built from the UI kit in Assets/Art/UI/ (docs/tasarim/15-gorsel-stil.md, UI kiti):
    /// wood frame + sage linen windows, wood / green / red buttons, cards for rows, Tier slots.
    /// The 9-slice borders come from ui-borders.json (same numbers as the importer). If the kit
    /// is missing, the old flat <see cref="Gui"/> styles are used so the windows still work.
    /// One place for the new look, until the windows move to uGUI.
    /// </summary>
    public static class Kit
    {
        // Resurrect 64 colours from the kit.
        static readonly Color Ink = Hex(0x45293f);
        static readonly Color InkFaint = new Color(0.27f, 0.16f, 0.25f, 0.6f);
        static readonly Color Paper = Hex(0xf2e8d0);
        static readonly Color Bad = Hex(0x9e4539);
        static readonly Color Fine = Hex(0x1e6f50);

        /// <summary>True when the kit textures were found.</summary>
        public static bool HasKit { get; private set; }

        public static GUIStyle Window, Plate, Card, Dark, Text, Bold, Small, Faint, Header, Warn, Good, Light, Input,
            Wood, Green, Red, Flat, Close, Tab, TabOn, Slot, SlotOn;

        static readonly Dictionary<string, GUIStyle> tierSlots = new Dictionary<string, GUIStyle>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics()
        {
            Window = null;
            tierSlots.Clear();
        }

        /// <summary>Call after <see cref="Gui.Begin"/> in every OnGUI that uses the kit.</summary>
        public static void Begin()
        {
            if (Window != null) return;
            var win = ArtCatalog.Ui("window");
            HasKit = win != null;

            Text = new GUIStyle(GUI.skin.label) { fontSize = 13, wordWrap = false, padding = new RectOffset(2, 2, 2, 2) };
            Text.normal.textColor = HasKit ? Ink : Color.white;
            Bold = new GUIStyle(Text) { fontStyle = FontStyle.Bold };
            Header = new GUIStyle(Bold) { fontSize = 15 };
            Small = new GUIStyle(Text) { fontSize = 11, wordWrap = true };
            Faint = new GUIStyle(Small);
            Faint.normal.textColor = HasKit ? InkFaint : new Color(1f, 1f, 1f, 0.5f);
            Warn = new GUIStyle(Text) { wordWrap = true };
            Warn.normal.textColor = HasKit ? Bad : new Color(1f, 0.55f, 0.5f);
            Good = new GUIStyle(Text);
            Good.normal.textColor = HasKit ? Fine : new Color(0.55f, 1f, 0.6f);
            Light = new GUIStyle(Text);
            Light.normal.textColor = Paper;

            if (!HasKit)
            {
                Window = new GUIStyle(GUI.skin.box) { padding = new RectOffset(10, 10, 8, 8) };
                Window.normal.background = Gui.Window?.normal.background;
                Plate = new GUIStyle(GUI.skin.box) { fontSize = 14, fontStyle = FontStyle.Bold };
                Card = Dark = new GUIStyle(GUI.skin.box);
                Input = new GUIStyle(GUI.skin.textField) { fontSize = 13 };
                Wood = Green = Red = Flat = Tab = new GUIStyle(GUI.skin.button) { fontSize = 13 };
                TabOn = new GUIStyle(Tab) { fontStyle = FontStyle.Bold };
                Close = new GUIStyle(GUI.skin.button) { fontSize = 11 };
                Slot = SlotOn = new GUIStyle(GUI.skin.box);
                return;
            }

            Window = Make("window", 9, 9, 11, 11);
            Window.padding = new RectOffset(14, 16, 18, 16);
            Plate = Make("button_wood_normal", 4, 4, 4, 4);
            Plate.fontSize = 13;
            Plate.fontStyle = FontStyle.Bold;
            Plate.alignment = TextAnchor.MiddleCenter;
            Plate.normal.textColor = Paper;
            Plate.padding = new RectOffset(12, 12, 2, 3);
            Card = Make("card", 3, 3, 3, 3);
            Card.padding = new RectOffset(6, 6, 4, 4);
            Card.margin = new RectOffset(0, 0, 2, 2);
            Dark = Make("box_dark", 3, 3, 3, 3);
            Dark.padding = new RectOffset(6, 6, 4, 4);
            Input = Make("input_normal", 3, 3, 3, 3, "input_focus", null, "input_focus");
            Input.fontSize = 13;
            Input.normal.textColor = Input.focused.textColor = Input.hover.textColor = Ink;
            Input.padding = new RectOffset(5, 5, 3, 3);
            Input.alignment = TextAnchor.MiddleLeft;
            Input.clipping = TextClipping.Clip;

            Wood = Button("wood", Paper);
            Green = Button("green", Color.white);
            Red = Button("red", Color.white);
            Flat = Make("button_flat_normal", 3, 3, 3, 3, "button_flat_hover", "button_flat_pressed");
            ButtonText(Flat, Ink);
            Tab = Make("tab_inactive", 4, 4, 4, 1);
            ButtonText(Tab, Ink);
            TabOn = Make("tab_active", 4, 4, 4, 1);
            ButtonText(TabOn, Paper);
            Close = Make("button_close_normal", 0, 0, 0, 0, "button_close_hover", "button_close_pressed");
            Slot = Make("slot_empty", 4, 4, 4, 4);
            Slot.alignment = TextAnchor.MiddleCenter;
            Slot.fontSize = 10;
            Slot.normal.textColor = Ink;
            SlotOn = Make("slot_selected", 4, 4, 4, 4);
            SlotOn.alignment = TextAnchor.MiddleCenter;
            SlotOn.fontSize = 10;
            SlotOn.normal.textColor = Ink;
        }

        /// <summary>A slot whose frame shows the Tier colour (empty slot for stacks).</summary>
        public static GUIStyle SlotFor(string tier)
        {
            if (string.IsNullOrEmpty(tier) || !HasKit) return Slot;
            if (tierSlots.TryGetValue(tier, out var s)) return s;
            s = ArtCatalog.Ui("slot_tier_" + tier) != null ? Make("slot_tier_" + tier, 4, 4, 4, 4) : Slot;
            s.alignment = TextAnchor.MiddleCenter;
            s.fontSize = 10;
            s.normal.textColor = Ink;
            tierSlots[tier] = s;
            return s;
        }

        /// <summary>A small Tier-coloured square at the start of a row.</summary>
        public static void TierMark(string tier, string label = "")
        {
            GUILayout.Box(label, SlotFor(tier), GUILayout.Width(22), GUILayout.Height(22));
        }

        static GUIStyle Button(string colour, Color text)
        {
            var s = Make($"button_{colour}_normal", 4, 4, 4, 4, $"button_{colour}_hover", $"button_{colour}_pressed");
            ButtonText(s, text);
            return s;
        }

        static void ButtonText(GUIStyle s, Color c)
        {
            s.fontSize = 12;
            s.fontStyle = FontStyle.Bold;
            s.alignment = TextAnchor.MiddleCenter;
            s.padding = new RectOffset(8, 8, 3, 4);
            s.margin = new RectOffset(2, 2, 2, 2);
            s.normal.textColor = s.hover.textColor = s.active.textColor = s.focused.textColor = c;
        }

        static GUIStyle Make(string normal, int l, int t, int r, int b, string hover = null, string pressed = null, string focused = null)
        {
            var s = new GUIStyle { border = new RectOffset(l, r, t, b) };
            s.normal.background = ArtCatalog.Ui(normal);
            if (hover != null) s.hover.background = ArtCatalog.Ui(hover);
            if (pressed != null) s.active.background = ArtCatalog.Ui(pressed);
            if (focused != null) s.focused.background = ArtCatalog.Ui(focused);
            return s;
        }

        static Color Hex(int rgb) => new Color(((rgb >> 16) & 255) / 255f, ((rgb >> 8) & 255) / 255f, (rgb & 255) / 255f);

        /// <summary>Thousands with dots, as the drafts show coin ("1.240").</summary>
        public static string Num(long n) => n.ToString("#,0", System.Globalization.CultureInfo.GetCultureInfo("tr-TR"));
    }

    /// <summary>
    /// A kit window: wood frame, title on the plate above it, close button, dragged by the plate
    /// or the top edge. Begin returns false when the close button was pressed this frame.
    /// </summary>
    public sealed class KitWindow
    {
        public Rect Rect;
        public string Title;
        public bool Draggable = true;
        /// <summary>Small buttons left of the close button ("_" to minimise, "≡" for a menu...).</summary>
        public string[] Extra;
        /// <summary>Index into <see cref="Extra"/> pressed this frame, or -1.</summary>
        public int PressedExtra { get; private set; } = -1;
        /// <summary>The title plate blinks (a new whisper in a window in the back).</summary>
        public bool Flash;
        /// <summary>A click landed on this window this frame (to bring it to the front, stop a flash).</summary>
        public bool Clicked { get; private set; }
        bool dragging;
        Vector2 grab;

        public KitWindow(string title, float width, float height)
        {
            Title = title;
            Rect = new Rect((Gui.Width - width) / 2f, Mathf.Max(40f, (Gui.Height - height) / 2f - 20f), width, height);
        }

        public void Center()
        {
            Rect.x = (Gui.Width - Rect.width) / 2f;
            Rect.y = Mathf.Max(40f, (Gui.Height - Rect.height) / 2f - 20f);
        }

        Rect PlateRect
        {
            get
            {
                var reserve = 2f * (30f + (Extra?.Length ?? 0) * 20f);
                var w = Mathf.Min(Rect.width - reserve, Mathf.Max(90f, Kit.Plate.CalcSize(new GUIContent(Title)).x + 8f));
                return new Rect(Rect.x + (Rect.width - w) / 2f, Rect.y - 9f, w, 22f);
            }
        }

        /// <summary>Draws the frame and starts a GUILayout area inside it. Always call <see cref="End"/>.</summary>
        public bool Begin()
        {
            Kit.Begin();
            var plate = PlateRect;
            var e = Event.current;
            Clicked = e.type == EventType.MouseDown && (Rect.Contains(e.mousePosition) || plate.Contains(e.mousePosition));
            HandleDrag(plate);
            Gui.Block(Rect);
            Gui.Block(plate);
            GUI.Box(Rect, GUIContent.none, Kit.Window);
            var old = GUI.color;
            if (Flash && Mathf.Repeat(Time.unscaledTime, 0.8f) < 0.4f) GUI.color = new Color(1f, 0.85f, 0.45f);
            GUI.Box(plate, Title, Kit.Plate);
            GUI.color = old;
            var open = !GUI.Button(new Rect(Rect.xMax - 22f, Rect.y + 4f, 16f, 16f), Kit.HasKit ? "" : "x", Kit.Close);
            PressedExtra = -1;
            for (var i = 0; Extra != null && i < Extra.Length; i++)
                if (GUI.Button(new Rect(Rect.xMax - 42f - i * 20f, Rect.y + 4f, 18f, 16f), Extra[i], Kit.Flat)) PressedExtra = i;
            var pad = Kit.Window.padding;
            GUILayout.BeginArea(new Rect(Rect.x + pad.left, Rect.y + pad.top, Rect.width - pad.horizontal, Rect.height - pad.vertical));
            return open;
        }

        public void End() => GUILayout.EndArea();

        void HandleDrag(Rect plate)
        {
            if (!Draggable) return;
            var e = Event.current;
            var top = new Rect(Rect.x, Rect.y, Rect.width - 26f - (Extra?.Length ?? 0) * 20f, 14f);
            switch (e.type)
            {
                case EventType.MouseDown when e.button == 0 && (plate.Contains(e.mousePosition) || top.Contains(e.mousePosition)):
                    dragging = true;
                    grab = e.mousePosition - Rect.position;
                    e.Use();
                    break;
                case EventType.MouseDrag when dragging:
                    Rect.position = e.mousePosition - grab;
                    Rect.x = Mathf.Clamp(Rect.x, -Rect.width + 60f, Gui.Width - 60f);
                    Rect.y = Mathf.Clamp(Rect.y, 12f, Gui.Height - 30f);
                    e.Use();
                    break;
                case EventType.MouseUp when dragging:
                    dragging = false;
                    e.Use();
                    break;
            }
        }
    }
}
