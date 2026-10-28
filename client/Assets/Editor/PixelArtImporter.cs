using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// Applies pixel-art import settings to every texture under Assets/Art/:
    /// 32 pixels per unit (one 32x32 tile = one world unit), point filtering,
    /// no compression and no mipmaps, so sprites stay sharp and on the tile grid.
    /// Slicing (sprite mode and rects) is left to the Sprite Editor.
    ///
    /// UI kit (Assets/Art/UI/): 9-slice borders come from ui-borders.json, written by
    /// tools/ui-kit/make_ui_kit.py. cursor_*.png are imported as cursors.
    /// </summary>
    public class PixelArtImporter : AssetPostprocessor
    {
        const string ArtRoot = "Assets/Art/";
        const string UiRoot = "Assets/Art/UI/";
        const string BordersPath = UiRoot + "ui-borders.json";
        const int PixelsPerUnit = 32;

        // Bump to reimport existing art after changing the settings below.
        public override uint GetVersion() => 2;

        [Serializable] class Border { public string name; public int l, t, r, b; }
        [Serializable] class BorderList { public Border[] items; }

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

            if (assetPath.StartsWith(UiRoot)) PrepareUi(importer);
        }

        void PrepareUi(TextureImporter importer)
        {
            var name = Path.GetFileNameWithoutExtension(assetPath);
            if (name.StartsWith("cursor_"))
            {
                importer.textureType = TextureImporterType.Cursor;
                importer.isReadable = true;
                return;
            }

            context.DependsOnSourceAsset(BordersPath);
            if (!File.Exists(BordersPath)) return;
            var list = JsonUtility.FromJson<BorderList>(File.ReadAllText(BordersPath));
            if (list?.items == null) return;
            foreach (var b in list.items)
            {
                if (b.name != name) continue;
                var settings = new TextureImporterSettings();
                importer.ReadTextureSettings(settings);
                settings.spriteMeshType = SpriteMeshType.FullRect; // tight meshes break 9-slice
                importer.SetTextureSettings(settings);
                importer.spriteBorder = new Vector4(b.l, b.b, b.r, b.t); // Unity order: left, bottom, right, top
                return;
            }
        }
    }
}
