using System;
using System.IO;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// Renders the UI prefabs with sample data into PNGs, over the matching draft, so a layout can
    /// be checked without Play mode (also from batchmode on a copy of the project):
    ///   Unity -batchmode -projectPath client -executeMethod CollectionGame.EditorTools.UiShots.Capture
    ///         -shotOut /some/dir [-draftDir docs/gorsel/ui-taslaklar]
    /// Writes hud.png (alone), hud-over-draft.png (on hud3 at half strength) and the same for canta-v2.
    /// </summary>
    public static class UiShots
    {
        [MenuItem("CollectionGame/UI/Capture Shots")]
        public static void CaptureFromMenu() => Run(Path.GetFullPath("../ui-shots"), Path.GetFullPath("../docs/gorsel/ui-taslaklar"));

        public static void Capture()
        {
            var outDir = Arg("-shotOut") ?? Path.GetFullPath("../ui-shots");
            var drafts = Arg("-draftDir") ?? Path.GetFullPath("../docs/gorsel/ui-taslaklar");
            try
            {
                Run(outDir, drafts);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                EditorApplication.Exit(1);
            }
        }

        static void Run(string outDir, string drafts)
        {
            UiPrefabBuilder.Build();
            Directory.CreateDirectory(outDir);
            Shot(outDir, "hud", Path.Combine(drafts, "hud3.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
            });
            Shot(outDir, "canta", Path.Combine(drafts, "canta-v2.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                FillBag(Spawn<BagView>(canvas, "Bag"));
            });
            Shot(outDir, "menu", Path.Combine(drafts, "canta-v2.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                FillBag(Spawn<BagView>(canvas, "Bag"));
                var pop = Spawn<PopupView>(canvas, "Popup");
                pop.SendMessage("Awake", SendMessageOptions.DontRequireReceiver);
                pop.ShowMenu("Sazan · 3 adet", new (string, Action)[] { ("Deftere koy", () => { }), ("Kilitle", () => { }), ("Takasa ekle", null), ("Sat / Parçala (NPC yanında)", null) });
                ((RectTransform)pop.menu).anchoredPosition = new Vector2(1100, 360);
            });
            Debug.Log($"[UI] Shots written to {outDir}");
        }

        static T Spawn<T>(Canvas canvas, string name) where T : Component
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Resources/UI/{name}.prefab");
            var go = (GameObject)UnityEngine.Object.Instantiate(prefab, canvas.transform, false);
            return go.GetComponent<T>();
        }

        static void FillHud(HudView h)
        {
            h.place.text = "Liman";
            h.info.text = "12 kişi görüşte";
            h.score.text = "1.820";
            h.coin.text = "1.240";
            h.diamond.text = "85";
            h.level.text = "Lv 7";
            HudView.Fill(h.xpFill, 0.62f);
            h.xpText.text = "XP 1.240 / 2.000";
            HudView.Fill(h.energyFill, 0.72f);
            h.energyText.text = "Enerji 72/100";
            HudView.Fill(h.rodFill, 0.18f);
            h.rodFillImage.sprite = h.rodLow;
            h.rodText.text = "Olta %18";
            h.bait.SetItem("lake.bait.worm", "", 12, false);
            h.baitText.text = "Yem: solucan";
            h.chatLog.text = "<color=#e6904e>Ece:</color> göl kenarı bugün çok kalabalık\n<color=#8fd3ff>Mert:</color> kristal setini bitirdin mi?\n<color=#f9c22b>Sistem:</color> Kaan bir Pristine Epic yakaladı!";
            h.questsAlert.SetActive(true);
        }

        static void FillBag(BagView b)
        {
            b.capacity.text = "23 / 40";
            b.balance.text = "1.240 Coin · 85 toz";
            string[] tiers = { "common", "rare", "", "epic", "", "legendary", "common", "mythic" };
            for (var i = 0; i < 40; i++)
            {
                var s = UnityEngine.Object.Instantiate(b.slotTemplate, b.grid, false);
                s.gameObject.SetActive(true);
                if (i < 23) s.SetItem(i % 3 == 0 ? "lake.fish.sazan" : i % 3 == 1 ? "lake.fish.levrek" : "lake.junk.boot", tiers[i % tiers.Length], i % 4 == 2 ? 4 : 1, i == 5);
                else s.SetEmpty();
            }
        }

        static void Shot(string outDir, string name, string draftPath, Action<Canvas> fill)
        {
            const int w = (int)UiRoot.RefWidth, h = (int)UiRoot.RefHeight;
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32);
            var camGo = new GameObject("ShotCamera");
            var cam = camGo.AddComponent<Camera>();
            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.33f, 0.49f, 0.39f);
            cam.targetTexture = rt;
            cam.cullingMask = 1 << 5;

            var canvasGo = new GameObject("ShotCanvas", typeof(RectTransform));
            canvasGo.layer = 5;
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = cam;
            canvas.planeDistance = 1;
            canvas.pixelPerfect = true;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
            scaler.scaleFactor = 1;
            scaler.referencePixelsPerUnit = UiRoot.PixelsPerUnit;

            Texture2D draft = null;
            RawImage back = null;
            if (File.Exists(draftPath))
            {
                draft = new Texture2D(2, 2) { filterMode = FilterMode.Point };
                draft.LoadImage(File.ReadAllBytes(draftPath));
                var bg = new GameObject("Draft", typeof(RectTransform));
                bg.layer = 5;
                bg.transform.SetParent(canvasGo.transform, false);
                var brt = (RectTransform)bg.transform;
                brt.anchorMin = Vector2.zero;
                brt.anchorMax = Vector2.one;
                brt.offsetMin = brt.offsetMax = Vector2.zero;
                back = bg.AddComponent<RawImage>();
                back.texture = draft;
                back.enabled = false;
            }

            fill(canvas);
            Save(cam, rt, Path.Combine(outDir, name + ".png"));
            if (back != null)
            {
                back.enabled = true;
                back.color = new Color(1, 1, 1, 0.55f);
                back.transform.SetAsLastSibling(); // draft drawn over the UI, half strength
                Save(cam, rt, Path.Combine(outDir, name + "-over-draft.png"));
                back.color = Color.white;
                back.transform.SetAsFirstSibling();
                Save(cam, rt, Path.Combine(outDir, name + "-draft.png"));
            }

            UnityEngine.Object.DestroyImmediate(canvasGo);
            UnityEngine.Object.DestroyImmediate(camGo);
            if (draft != null) UnityEngine.Object.DestroyImmediate(draft);
            rt.Release();
        }

        static void Save(Camera cam, RenderTexture rt, string path)
        {
            Canvas.ForceUpdateCanvases();
            cam.Render();
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            File.WriteAllBytes(path, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
                if (args[i] == name) return args[i + 1];
            return null;
        }
    }
}
