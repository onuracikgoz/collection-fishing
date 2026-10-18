using UnityEditor;
using UnityEngine;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// The game targets PC first: play in the Game view at 1920×1080 (not the
    /// Device Simulator) and build a resizable 1280×720 window. Applied once per
    /// machine when the project loads; menu: CollectionGame → Use PC Defaults.
    /// </summary>
    [InitializeOnLoad]
    public static class PcDefaults
    {
        const string AppliedKey = "CollectionGame.PcDefaults.v1";

        static PcDefaults()
        {
            if (EditorPrefs.GetBool(AppliedKey + Application.dataPath, false)) return;
            EditorApplication.delayCall += () =>
            {
                Apply();
                EditorPrefs.SetBool(AppliedKey + Application.dataPath, true);
            };
        }

        [MenuItem("CollectionGame/Use PC Defaults")]
        public static void Apply()
        {
            PlayModeWindow.SetViewType(PlayModeWindow.PlayModeViewTypes.GameView);
            PlayModeWindow.SetCustomRenderingResolution(1920, 1080, "Full HD (PC)");

            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.defaultIsNativeResolution = false;
            PlayerSettings.defaultScreenWidth = 1280;
            PlayerSettings.defaultScreenHeight = 720;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            AssetDatabase.SaveAssets();
            Debug.Log("[CollectionGame] PC defaults: Game view 1920×1080, windowed 1280×720 build");
        }
    }
}
