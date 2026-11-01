using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Bag window of draft canta-v2: capacity, an 8-wide slot grid, a footer line. Made by UiPrefabBuilder.</summary>
    public sealed class BagView : MonoBehaviour
    {
        public WindowView window;
        public Text capacity;
        public Text balance;
        public RectTransform grid;
        public SlotView slotTemplate;
        /// <summary>Window height around the slot rows (count line, trash row, padding): height = chrome + rows * 44.</summary>
        public float chrome = 120;
        /// <summary>Trash can: drop an item on it, confirm, the server throws it away (ITEM_DISCARD).</summary>
        public RectTransform trash;
        public Image trashHighlight;
    }
}
