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
    /// Now only used by IMGUI leftovers (map labels of stalls) and for <see cref="Num"/>; windows are uGUI.
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
        public static string Num(long n) =>
            n.ToString("#,0", System.Globalization.CultureInfo.InvariantCulture).Replace(',', '.'); // no culture data needed (WebGL)
    }
}
