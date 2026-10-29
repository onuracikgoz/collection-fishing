using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace CollectionGame.UI
{
    /// <summary>
    /// The one uGUI canvas of the game (docs/araclar/ui-uygulama.md). Layout units are UI kit pixels:
    /// the drafts in docs/gorsel/ui-taslaklar are 1408x896 with the kit at 1:1, and the canvas is
    /// scaled by a whole number so every kit pixel stays a square block of screen pixels.
    /// Window prefabs live in Resources/UI/ and are made by Editor/UiPrefabBuilder.cs.
    /// </summary>
    public sealed class UiRoot : MonoBehaviour
    {
        public const float RefWidth = 1408f;
        public const float RefHeight = 896f;
        /// <summary>Same as the kit sprites: one sprite pixel is one canvas unit.</summary>
        public const float PixelsPerUnit = 32f;

        static UiRoot instance;

        public Canvas Canvas { get; private set; }
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
            gameObject.AddComponent<GraphicRaycaster>();
            Rect = (RectTransform)transform;

            if (FindAnyObjectByType<EventSystem>() == null)
            {
                var es = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
                DontDestroyOnLoad(es);
            }
        }

        /// <summary>Whole-number scale that fits the 1408x896 layout, at least 1.</summary>
        public static float ScaleFor(int width, int height) =>
            Mathf.Max(1f, Mathf.Floor(Mathf.Min(height / RefHeight, width / RefWidth) + 0.0001f));

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
