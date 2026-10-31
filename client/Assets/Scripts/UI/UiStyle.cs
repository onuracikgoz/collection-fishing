using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// THE look of uGUI text, in one place (docs/araclar/ui-uygulama.md, Ortak stil): font sharpness
    /// and shadow for every GameText. Box shapes (corner rounding, the cream window fill) are the
    /// UI kit's: one CORNER number in tools/ui-kit/make_ui_kit.py.
    /// Lives at Resources/UiStyle.asset (CollectionGame > UI > Style asset makes it); without the
    /// asset these defaults are used. Change a value, press Play: every window follows.
    /// </summary>
    [CreateAssetMenu(menuName = "CollectionGame/UI Style", fileName = "UiStyle")]
    public sealed class UiStyle : ScriptableObject
    {
        [Header("Yazı (GameText)")]
        [Tooltip("Pixel fontun piksel ızgarası: yazı ekranda bu sayının katı piksel boyunda çizilir, böylece net kalır. Press Start 2P için 8. 0 = yuvarlama yok (pixel olmayan font).")]
        public int pixelGrid = 8;

        [Tooltip("Pixel fontta sahte kalın / italik yazıyı bulanıklaştırır: kapalıyken her yazı düz çizilir.")]
        public bool allowBoldItalic;

        [Tooltip("Açık renkli yazılar (koyu zemin üstünde) gölge alır.")]
        public bool shadowOnLightText = true;

        public Color shadowColor = new Color(0.08f, 0.05f, 0.08f, 0.85f);

        [Tooltip("Gölge kayması, yazının bir font pikseli cinsinden (1 = bir piksel sağa, bir piksel aşağı).")]
        public float shadowPixels = 1f;

        static UiStyle current;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => current = null;

        public static UiStyle Get()
        {
            if (current != null) return current;
            current = Resources.Load<UiStyle>("UiStyle");
            if (current == null)
            {
                current = CreateInstance<UiStyle>();
                current.hideFlags = HideFlags.DontSave;
            }
            return current;
        }
    }
}
