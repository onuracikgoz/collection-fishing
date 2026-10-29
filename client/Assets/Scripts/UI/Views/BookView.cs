using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Collection Book laid out like draft defter-v2: totals line, two facing pages of 3x2 record cards,
    /// page navigation. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class BookView : MonoBehaviour
    {
        [System.Serializable]
        public sealed class Card
        {
            public Image frame;
            public Text mark, name;
            public GameObject newBadge;
            public CardHover hover;
        }

        [System.Serializable]
        public sealed class Page
        {
            public Text title, count;
            public Card[] cards;
        }

        public WindowView window;
        public Text owner, totalText, luck, score;
        public RectTransform totalFill;
        public Page[] pages;
        public Button prev, next;
        public Text nav;
        /// <summary>record_common..mythic (Tiers.All order), record_found, record_unknown.</summary>
        public Sprite[] tierFrames;
        public Sprite found, unknown;
    }
}
