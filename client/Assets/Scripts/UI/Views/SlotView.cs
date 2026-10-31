using System;
using CollectionGame.Net;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// One 40x40 item slot (kit slot_*): frame shows the Tier, a short name stands in for the icon
    /// until item icons exist, the count sits in the corner. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class SlotView : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerClickHandler,
        IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        public Image frame;
        /// <summary>The item's picture (placeholder from ItemIcons until the real icons come).</summary>
        public Image icon;
        /// <summary>Letters only where a picture does not fit the meaning (friend avatars); items never write their name.</summary>
        public Text label;
        public Text count;
        public GameObject lockMark;
        public Sprite empty, selected, locked;
        /// <summary>common, rare, epic, legendary, mythic (Tiers.All order).</summary>
        public Sprite[] tiers;

        public Action<SlotView> Clicked, RightClicked, Hovered, Left;
        /// <summary>Drag from this slot (bag → trade window): began, moved, dropped, with the pointer event.</summary>
        public Action<SlotView, PointerEventData> DragBegan, Dragged, Dropped;
        public object Data { get; set; }

        public void SetEmpty(bool lockedSlot = false)
        {
            Data = null;
            frame.sprite = lockedSlot ? locked : empty;
            label.text = "";
            SetIconSprite(null);
            count.text = "";
            if (lockMark != null) lockMark.SetActive(false);
        }

        public void SetItem(string defId, string tier, int amount, bool isLocked, bool isSelected = false)
        {
            var rank = Tiers.Rank(tier);
            frame.sprite = isSelected ? selected : rank >= 0 && tiers != null && rank < tiers.Length ? tiers[rank] : empty;
            label.text = "";
            SetIconSprite(ItemIcons.For(defId));
            count.text = amount > 1 ? amount.ToString() : "";
            if (lockMark != null) lockMark.SetActive(isLocked);
        }

        /// <summary>Shows the placeholder picture for a key (quest event, chest, emote) instead of words.</summary>
        public void SetIcon(string key)
        {
            label.text = "";
            SetIconSprite(string.IsNullOrEmpty(key) ? null : ItemIcons.For(key));
        }

        void SetIconSprite(Sprite s)
        {
            if (icon == null) return;
            icon.sprite = s;
            icon.enabled = s != null;
        }

        /// <summary>"Sazan" → "Saza": four letters of the item name (old placeholder, kept for the book's unknown records).</summary>
        public static string Short(string defId)
        {
            var name = Fishing.FishingController.ItemName(defId);
            return name.Length <= 5 ? name : name.Substring(0, 4);
        }

        public void OnBeginDrag(PointerEventData e) => DragBegan?.Invoke(this, e);
        public void OnDrag(PointerEventData e) => Dragged?.Invoke(this, e);
        public void OnEndDrag(PointerEventData e) => Dropped?.Invoke(this, e);

        public void OnPointerEnter(PointerEventData e) => Hovered?.Invoke(this);
        public void OnPointerExit(PointerEventData e) => Left?.Invoke(this);

        public void OnPointerClick(PointerEventData e)
        {
            if (e.button == PointerEventData.InputButton.Right) RightClicked?.Invoke(this);
            else if (e.button == PointerEventData.InputButton.Left) Clicked?.Invoke(this);
        }
    }
}
