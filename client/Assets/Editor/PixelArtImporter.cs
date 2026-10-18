using UnityEditor;
using UnityEngine;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// Applies pixel-art import settings to every texture under Assets/Art/:
    /// 32 pixels per unit (one 32x32 tile = one world unit), point filtering,
    /// no compression and no mipmaps, so sprites stay sharp and on the tile grid.
    /// Slicing (sprite mode and rects) is left to the Sprite Editor.
    /// </summary>
    public class PixelArtImporter : AssetPostprocessor
    {
        const string ArtRoot = "Assets/Art/";
        const int PixelsPerUnit = 32;

        // Bump to reimport existing art after changing the settings below.
        public override uint GetVersion() => 1;

        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(ArtRoot)) return;

            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Sprite;
            importer.spritePixelsPerUnit = PixelsPerUnit;
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.wrapMode = TextureWrapMode.Clamp;
        }
    }
}
