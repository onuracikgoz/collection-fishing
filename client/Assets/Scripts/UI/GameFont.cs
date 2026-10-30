using System.Linq;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// The game's one font slot: the first font in Assets/Resources/Fonts/ (a .ttf or .otf dropped
    /// there), else Unity's built-in font. UiPrefabBuilder writes it into every uGUI text, and the
    /// IMGUI world labels (names, bubbles) use it through GUI.skin.
    /// </summary>
    public static class GameFont
    {
        /// <summary>Letters the font must have (docs/araclar/ui-uygulama.md, Yazı tipi).</summary>
        public const string Turkish = "çğıİöşüÇĞÖŞÜ";

        static Font font;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => font = null;

        public static Font Get()
        {
            if (font != null) return font;
            font = Resources.LoadAll<Font>("Fonts").OrderBy(f => f.name).FirstOrDefault();
            if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            return font;
        }

        /// <summary>True when the dropped font is used (not the built-in one).</summary>
        public static bool Custom => Get() != null && Get().name != "LegacyRuntime";

        /// <summary>The Turkish letters this font lacks (empty when all are there).</summary>
        public static string Missing()
        {
            var f = Get();
            if (f == null) return Turkish;
            f.RequestCharactersInTexture(Turkish);
            return new string(Turkish.Where(c => !f.HasCharacter(c)).ToArray());
        }
    }
}
