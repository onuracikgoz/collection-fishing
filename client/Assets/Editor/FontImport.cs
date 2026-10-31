using CollectionGame.UI;
using UnityEditor;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// The game font (Assets/Resources/Fonts/, see GameFont) is imported without anti-aliasing when
    /// UiStyle says it is a pixel font (pixelGrid > 0): glyphs stay hard pixels, not a blur.
    /// </summary>
    public sealed class FontImport : AssetPostprocessor
    {
        void OnPreprocessAsset()
        {
            if (!assetPath.StartsWith("Assets/Resources/Fonts/")) return;
            if (!(assetImporter is TrueTypeFontImporter font)) return;
            var mode = UiStyle.Get().pixelGrid > 0 ? FontRenderingMode.HintedRaster : FontRenderingMode.Smooth;
            if (font.fontRenderingMode != mode) font.fontRenderingMode = mode;
        }
    }
}
