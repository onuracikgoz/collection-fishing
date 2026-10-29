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

        public Action Closed;
        bool dragging;

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
                if (value && !gameObject.activeSelf) transform.SetAsLastSibling();
                gameObject.SetActive(value);
            }
        }

        public void OnPointerDown(PointerEventData e) => transform.SetAsLastSibling();

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
