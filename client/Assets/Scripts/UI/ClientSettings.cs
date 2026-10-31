using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// Settings that only live on this device (draft ayarlar-genel): volumes, UI size, full screen,
    /// names, bubbles, announcements. Kept in PlayerPrefs. Server-side settings ("PM kapalı") are not here.
    /// </summary>
    public static class ClientSettings
    {
        static float Get(string key, float fallback) => PlayerPrefs.GetFloat("cg_set_" + key, fallback);
        static void Set(string key, float value)
        {
            PlayerPrefs.SetFloat("cg_set_" + key, value);
            PlayerPrefs.Save();
        }

        static bool Flag(string key, bool fallback) => Get(key, fallback ? 1f : 0f) > 0.5f;
        static void SetFlag(string key, bool value) => Set(key, value ? 1f : 0f);

        /// <summary>0..1. No music yet; kept for when it comes.</summary>
        public static float Music { get => Get("music", 0.6f); set => Set("music", Mathf.Clamp01(value)); }
        public static float Effects { get => Get("effects", 0.85f); set => Set("effects", Mathf.Clamp01(value)); }
        /// <summary>The bite sound plays even when music is low.</summary>
        public static bool HitSound { get => Flag("hit", true); set => SetFlag("hit", value); }
        /// <summary>0 = automatic (largest whole number that fits), else 1, 2 or 3.</summary>
        public static int UiScale { get => Mathf.RoundToInt(Get("uiscale", 0f)); set => Set("uiscale", Mathf.Clamp(value, 0, 3)); }
        public static bool ShowNames { get => Flag("names", true); set => SetFlag("names", value); }
        public static bool Announcements { get => Flag("announce", true); set => SetFlag("announce", value); }
        public static bool Bubbles { get => Flag("bubbles", true); set => SetFlag("bubbles", value); }
        /// <summary>Chat log height the player dragged it to (0 = the default).</summary>
        public static float ChatHeight { get => Get("chatheight", 0f); set => Set("chatheight", value); }

        public static string UiScaleName(int s) => s == 0 ? $"{UiRoot.AutoScale(Screen.width, Screen.height):0}x (önerilen)" : $"{s}x";
    }
}
