using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Collection Book laid out like draft defter-v2: totals line, two facing pages of 3x2 record cards,
    /// arrow buttons at the far left and right, and page turning by dragging (<see cref="flip"/>). Made by UiPrefabBuilder.
    /// </summary>
    public sealed class BookView : MonoBehaviour
    {
        [System.Serializable]
        public sealed class Card
        {
            public Image frame;
            public Text mark, name;
            /// <summary>The item's picture on found and filled records (no name letters, 31.10.2026 Onur).</summary>
            public Image icon;
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
        /// <summary>Hold-and-drag page turning; null on a prefab built before version 38.</summary>
        public BookFlip flip;
        /// <summary>record_common..mythic (Tiers.All order), record_found, record_unknown.</summary>
        public Sprite[] tierFrames;
        public Sprite found, unknown;
    }
}
