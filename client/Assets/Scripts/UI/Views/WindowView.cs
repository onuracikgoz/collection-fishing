using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Kit window frame: title on the wood plate above the frame (drag the plate to move the window),
    /// close button in the corner, content under <see cref="body"/>. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class WindowView : MonoBehaviour, IBeginDragHandler, IDragHandler, IPointerDownHandler
    {
        public Text title;
        public Button close;
        public RectTransform body;
        public RectTransform plate;
        /// <summary>Optional grip square (whisper windows): dragging it moves the window too.</summary>
        public RectTransform handle;
        /// <summary>
        /// The "!" button beside the title (01.11.2026, Onur): opens the info window with this window's
        /// help, read from Locales keys info.&lt;infoKey&gt;.&lt;n&gt;.title / .text. One per window, not per tab.
        /// </summary>
        public Button info;
        public string infoKey;

        /// <summary>
        /// While this window is open the world takes no input: no walking (mouse or WASD), no casting.
        /// Off only for windows that stay open while playing (fısıltı, level-up box).
        /// </summary>
        public bool blocksWorld = true;

        /// <summary>How many world-blocking windows are open now (see UiRoot.BlocksWorld).</summary>
        public static int OpenBlocking { get; private set; }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => OpenBlocking = 0;

        public Action Closed;
        bool dragging, counted;

        void OnEnable()
        {
            if (!blocksWorld || counted) return;
            counted = true;
            OpenBlocking++;
        }

        void OnDisable()
        {
            if (!counted) return;
            counted = false;
            OpenBlocking--;
        }

        void Awake()
        {
            if (close != null) close.onClick.AddListener(() =>
            {
                if (Closed != null) Closed();
                else gameObject.SetActive(false);
            });
            if (info != null && !string.IsNullOrEmpty(infoKey))
                info.onClick.AddListener(() => InfoView.Toggle(title != null ? title.text : "", infoKey));
        }

        public bool Open
        {
            get => gameObject.activeSelf;
            set
            {
                if (value && !gameObject.activeSelf) Raise();
                gameObject.SetActive(value);
            }
        }

        void OnDestroy() => OnDisable();

        public void OnPointerDown(PointerEventData e) => Raise();

        /// <summary>Brings this window (and the prefab it sits in) in front of the other windows.</summary>
        public void Raise()
        {
            transform.SetAsLastSibling();
            var t = transform;
            while (t.parent != null && t.parent.GetComponent<Canvas>() == null) t = t.parent;
            t.SetAsLastSibling();
        }

        public void OnBeginDrag(PointerEventData e) =>
            dragging = Hit(plate, e) || Hit(handle, e);

        static bool Hit(RectTransform r, PointerEventData e) =>
            r != null && r.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint(r, e.pressPosition, e.pressEventCamera);

        public void OnDrag(PointerEventData e)
        {
            if (!dragging) return;
            var rt = (RectTransform)transform;
            var canvas = GetComponentInParent<Canvas>();
            rt.anchoredPosition += e.delta / (canvas != null ? canvas.scaleFactor : 1f);
            KeepOnScreen(rt);
        }

        /// <summary>A dragged window stays inside the screen (at least its title can be grabbed again).</summary>
        static void KeepOnScreen(RectTransform rt)
        {
            var parent = rt.parent as RectTransform;
            if (parent == null) return;
            var corners = new Vector3[4];
            rt.GetWorldCorners(corners);
            var area = parent.rect;
            var min = parent.InverseTransformPoint(corners[0]);
            var max = parent.InverseTransformPoint(corners[2]);
            var shift = Vector2.zero;
            if (min.x < area.xMin) shift.x = area.xMin - min.x;
            else if (max.x > area.xMax) shift.x = area.xMax - max.x;
            if (min.y < area.yMin) shift.y = area.yMin - min.y;
            else if (max.y > area.yMax) shift.y = area.yMax - max.y;
            rt.anchoredPosition += shift;
        }
    }
}
