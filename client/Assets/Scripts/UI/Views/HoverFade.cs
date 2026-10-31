using UnityEngine;
using UnityEngine.EventSystems;

namespace CollectionGame.UI.Views
{
    /// <summary>See-through controls (chat icons) that come up to full strength under the pointer.</summary>
    public sealed class HoverFade : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
    {
        public CanvasGroup group;
        [Range(0f, 1f)] public float idle = 0.55f;

        void OnEnable()
        {
            if (group != null) group.alpha = idle;
        }

        public void OnPointerEnter(PointerEventData e)
        {
            if (group != null) group.alpha = 1f;
        }

        public void OnPointerExit(PointerEventData e)
        {
            if (group != null) group.alpha = idle;
        }
    }
}
