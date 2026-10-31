using UnityEngine;
using UnityEngine.EventSystems;

namespace CollectionGame.UI.Views
{
    /// <summary>Name and shortcut of an icon button, shown in the tooltip card on hover (HUD buttons). Made by UiPrefabBuilder.</summary>
    public sealed class HoverTip : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
    {
        public string title;
        public string note;

        /// <summary>The one tooltip card (set by World/WorldHud).</summary>
        public static PopupView Popup { get; set; }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => Popup = null;

        public void OnPointerEnter(PointerEventData e)
        {
            if (Popup != null) Popup.ShowTooltip(new PopupView.Card { title = title, note = note });
        }

        public void OnPointerExit(PointerEventData e)
        {
            if (Popup != null) Popup.HideTooltip();
        }

        void OnDisable() => OnPointerExit(null);
    }
}
