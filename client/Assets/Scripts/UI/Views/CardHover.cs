using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace CollectionGame.UI.Views
{
    /// <summary>Hover and click events of any card (book records, showcase slots).</summary>
    public sealed class CardHover : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerClickHandler
    {
        public Action Entered, Exited, Clicked, RightClicked;

        public void OnPointerEnter(PointerEventData e) => Entered?.Invoke();
        public void OnPointerExit(PointerEventData e) => Exited?.Invoke();

        public void OnPointerClick(PointerEventData e)
        {
            if (e.button == PointerEventData.InputButton.Right) RightClicked?.Invoke();
            else if (e.button == PointerEventData.InputButton.Left) Clicked?.Invoke();
        }
    }
}
