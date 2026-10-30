using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace CollectionGame.UI
{
    /// <summary>
    /// The one uGUI canvas of the game (docs/araclar/ui-uygulama.md). Layout units are UI kit pixels:
    /// the drafts in docs/gorsel/ui-taslaklar are 1408x896 and show the kit at 2x, so layout units are
    /// draft pixels and one kit pixel is two units; kit pixels stay whole screen pixels.
    /// Window prefabs live in Resources/UI/ and are made by Editor/UiPrefabBuilder.cs.
    /// </summary>
    public sealed class UiRoot : MonoBehaviour
    {
        public const float RefWidth = 1408f;
        public const float RefHeight = 896f;
        /// <summary>
        /// Canvas units are draft pixels; the drafts show the kit at 2x (704x448 logical screen),
        /// so one kit pixel is two canvas units: sprites are 32 per unit, the canvas counts 64 (Image size = sprite PPU / canvas PPU).
        /// </summary>
        public const float PixelsPerUnit = 64f;

        static UiRoot instance;

        public Canvas Canvas { get; private set; }
        GraphicRaycaster raycaster;
        static readonly List<RaycastResult> hits = new List<RaycastResult>();
        public RectTransform Rect { get; private set; }
        CanvasScaler scaler;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => instance = null;

        public static UiRoot Get()
        {
            if (instance != null) return instance;
            var go = new GameObject("UI", typeof(RectTransform));
            DontDestroyOnLoad(go);
            instance = go.AddComponent<UiRoot>();
            instance.Build();
            return instance;
        }

        void Build()
        {
            Canvas = gameObject.AddComponent<Canvas>();
            Canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            Canvas.pixelPerfect = true;
            scaler = gameObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
            scaler.referencePixelsPerUnit = PixelsPerUnit;
            scaler.scaleFactor = ScaleFor(Screen.width, Screen.height);
            raycaster = gameObject.AddComponent<GraphicRaycaster>();
            Rect = (RectTransform)transform;

            if (FindAnyObjectByType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
                DontDestroyOnLoad(es);
            }
        }

        /// <summary>Kit pixel size in screen pixels: the largest whole number that fits the 704x448 logical screen.</summary>
        public static float AutoScale(int width, int height) =>
            Mathf.Max(1f, Mathf.Floor(Mathf.Min(height / (RefHeight / 2f), width / (RefWidth / 2f)) + 0.0001f));

        /// <summary>
        /// Canvas scale factor: half the kit pixel size (the player's choice in Ayarlar > Arayüz boyutu,
        /// or <see cref="AutoScale"/>), since a canvas unit is half a kit pixel.
        /// </summary>
        public static float ScaleFor(int width, int height) =>
            (ClientSettings.UiScale > 0 ? ClientSettings.UiScale : AutoScale(width, height)) / 2f;

        void Update() => scaler.scaleFactor = ScaleFor(Screen.width, Screen.height);

        /// <summary>A copy of Resources/UI/&lt;name&gt; under the canvas, or null when the prefab is missing.</summary>
        public T Spawn<T>(string name) where T : Component
        {
            var prefab = Resources.Load<GameObject>("UI/" + name);
            if (prefab == null)
            {
                Debug.LogError($"[UI] Missing prefab Resources/UI/{name} (CollectionGame > UI > Build Prefabs)");
                return null;
            }
            var go = Instantiate(prefab, transform, false);
            go.name = name;
            return go.GetComponent<T>();
        }

        /// <summary>The mouse is over a uGUI element: clicks there are not walking or casting.</summary>
        public static bool PointerOverUi
        {
            get
            {
                var es = EventSystem.current;
                return es != null && es.IsPointerOverGameObject();
            }
        }

        /// <summary>
        /// A uGUI window or bar covers this screen point (pixels, origin bottom left). IMGUI labels in
        /// the world (names, bubbles, stall tags) skip such points so they never sit on a window.
        /// </summary>
        public static bool Covers(Vector2 screen)
        {
            if (instance == null || instance.raycaster == null || EventSystem.current == null) return false;
            hits.Clear();
            instance.raycaster.Raycast(new PointerEventData(EventSystem.current) { position = screen }, hits);
            return hits.Count > 0;
        }

        /// <summary>
        /// THE check for world input (walking, casting): false while a text field has the keyboard or
        /// any window is open (bag, book, profile, NPC windows, trade...). Movement and fishing ask this.
        /// </summary>
        public static bool BlocksWorld => Typing || Views.WindowView.OpenBlocking > 0;

        /// <summary>A uGUI text field has the keyboard: game keys are off.</summary>
        public static bool Typing
        {
            get
            {
                var es = EventSystem.current;
                var go = es != null ? es.currentSelectedGameObject : null;
                if (go == null) return false;
                var field = go.GetComponent<InputField>();
                return field != null && field.isFocused;
            }
        }
    }
}
