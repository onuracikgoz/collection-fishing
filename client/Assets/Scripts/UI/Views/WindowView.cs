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
            dragging = plate != null && RectTransformUtility.RectangleContainsScreenPoint(plate, e.pressPosition, e.pressEventCamera);

        public void OnDrag(PointerEventData e)
        {
            if (!dragging) return;
            var rt = (RectTransform)transform;
            var canvas = GetComponentInParent<Canvas>();
            rt.anchoredPosition += e.delta / (canvas != null ? canvas.scaleFactor : 1f);
        }
    }
}
