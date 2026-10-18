using System.Collections.Generic;
using System.IO;
using System.Linq;
using CollectionGame.Art;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// Keeps Assets/Resources/ArtCatalog.asset listing every texture under
    /// Assets/Art/LPC/. Runs when the editor loads, when art is imported and
    /// before a build. Menu: CollectionGame → Refresh Art Catalog.
    /// </summary>
    [InitializeOnLoad]
    public class ArtCatalogBuilder : AssetPostprocessor, IPreprocessBuildWithReport
    {
        const string AssetPath = "Assets/Resources/" + ArtCatalog.ResourceName + ".asset";

        static ArtCatalogBuilder()
        {
            EditorApplication.delayCall += () => Refresh();
        }

        public int callbackOrder => 0;

        public void OnPreprocessBuild(BuildReport report) => Refresh();

        static void OnPostprocessAllAssets(string[] imported, string[] deleted, string[] moved, string[] movedFrom)
        {
            bool Touches(string[] paths) => paths.Any(p => p.StartsWith(ArtCatalog.Root));
            if (Touches(imported) || Touches(deleted) || Touches(moved) || Touches(movedFrom))
                EditorApplication.delayCall += () => Refresh();
        }

        [MenuItem("CollectionGame/Refresh Art Catalog")]
        public static void RefreshFromMenu()
        {
            var catalog = Refresh();
            Debug.Log($"[Art] ArtCatalog has {catalog.entries.Count} textures");
        }

        public static ArtCatalog Refresh()
        {
            var wanted = AssetDatabase.FindAssets("t:Texture2D", new[] { ArtCatalog.Root.TrimEnd('/') })
                .Select(AssetDatabase.GUIDToAssetPath)
                .Where(p => p.EndsWith(".png"))
                .OrderBy(p => p, System.StringComparer.Ordinal)
                .Select(p => new ArtCatalog.Entry
                {
                    path = p.Substring(ArtCatalog.Root.Length),
                    texture = AssetDatabase.LoadAssetAtPath<Texture2D>(p),
                })
                .Where(e => e.texture != null)
                .ToList();

            var catalog = AssetDatabase.LoadAssetAtPath<ArtCatalog>(AssetPath);
            if (catalog == null)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(AssetPath));
                catalog = ScriptableObject.CreateInstance<ArtCatalog>();
                catalog.entries = wanted;
                AssetDatabase.CreateAsset(catalog, AssetPath);
                AssetDatabase.SaveAssets();
                return catalog;
            }

            if (!Same(catalog.entries, wanted))
            {
                catalog.entries = wanted;
                EditorUtility.SetDirty(catalog);
                AssetDatabase.SaveAssetIfDirty(catalog);
            }
            return catalog;
        }

        static bool Same(List<ArtCatalog.Entry> a, List<ArtCatalog.Entry> b)
        {
            if (a == null || a.Count != b.Count) return false;
            for (var i = 0; i < a.Count; i++)
                if (a[i].path != b[i].path || a[i].texture != b[i].texture) return false;
            return true;
        }
    }
}
