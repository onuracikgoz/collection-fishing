using UnityEngine;
using UnityEngine.EventSystems;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// The grip on the chat log's top edge (31.10.2026, Onur): hold and drag up to make the log taller,
    /// down to make it shorter, between <see cref="minHeight"/> and <see cref="maxHeight"/>. The height
    /// is kept on this device (ClientSettings.ChatHeight). Made by UiPrefabBuilder.
    /// </summary>
    public sealed class ChatResize : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        public RectTransform target;
        public float minHeight = 48f;
        public float maxHeight = 560f;

        void Start()
        {
            var saved = ClientSettings.ChatHeight;
            if (saved > 0f && target != null) SetHeight(saved);
        }

        public void OnBeginDrag(PointerEventData e) { }

        public void OnDrag(PointerEventData e)
        {
            if (target == null) return;
            var canvas = GetComponentInParent<Canvas>();
            var scale = canvas != null ? canvas.scaleFactor : 1f;
            SetHeight(target.sizeDelta.y + e.delta.y / scale);
        }

        public void OnEndDrag(PointerEventData e)
        {
            if (target != null) ClientSettings.ChatHeight = target.sizeDelta.y;
        }

        void SetHeight(float h) =>
            target.sizeDelta = new Vector2(target.sizeDelta.x, Mathf.Round(Mathf.Clamp(h, minHeight, maxHeight)));
    }
}
