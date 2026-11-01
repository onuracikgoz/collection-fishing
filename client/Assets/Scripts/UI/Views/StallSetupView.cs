using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// "Tezgah kur" of draft tezgah-kur: title field, 12 stall slots with price tags, a dark panel for the
    /// picked item (price, Koy / Geri al), the bag below, and Tezgahı aç. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class StallSetupView : MonoBehaviour
    {
        public WindowView window;
        public InputField title;
        public Text stallHeader, stallHint;
        public SlotView[] stall;
        public PriceTag[] tags;
        public GameObject picked;
        public Text pickedName, pickedCondition;
        public InputField price, count;
        public Text countLabel;
        public Button put, takeBack;
        public Text bagHint, place;
        public RectTransform bagGrid;
        public SlotView bagTemplate;
        public Button open, recall, board;
    }
}
