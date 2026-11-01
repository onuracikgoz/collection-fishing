using UnityEngine;
using UnityEngine.EventSystems;

namespace CollectionGame.UI.Views
{
    /// <summary>Name and shortcut of an icon button, shown in the tooltip card on hover (HUD buttons). Made by UiPrefabBuilder.</summary>
    public sealed class HoverTip : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler
    {
        /// <summary>Text, or "@@key" for a Locales key (Loc.Resolve).</summary>
        public string title;
        public string note;
        /// <summary>Fills {key} in the note (the shortcut letter).</summary>
        public string noteArg;

        /// <summary>The one tooltip card (set by World/WorldHud).</summary>
        public static PopupView Popup { get; set; }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => Popup = null;

        public void OnPointerEnter(PointerEventData e)
        {
            if (Popup != null) Popup.ShowTooltip(new PopupView.Card { title = Loc.Resolve(title), note = Note() });
        }

        string Note()
        {
            var n = Loc.Resolve(note);
            return n != null && !string.IsNullOrEmpty(noteArg) ? n.Replace("{key}", noteArg) : n;
        }

        public void OnPointerExit(PointerEventData e)
        {
            if (Popup != null) Popup.HideTooltip();
        }

        void OnDisable() => OnPointerExit(null);
    }
}
