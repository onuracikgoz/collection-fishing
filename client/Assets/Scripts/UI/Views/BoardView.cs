using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Pazar Panosu of draft tezgah-pano: four ad cards a page, footer note, Reklam ver. Made by UiPrefabBuilder.</summary>
    public sealed class BoardView : MonoBehaviour
    {
        [System.Serializable]
        public sealed class Card
        {
            public GameObject root;
            public SlotView pet;
            public Text title, owner;
            public SlotView[] slots;
            public PriceTag[] tags;
            public Button go;
        }

        public WindowView window;
        public Text hint;
        public Card[] cards;
        public Text empty;
        public Button advertise;
        public Text advertiseText;
    }
}
