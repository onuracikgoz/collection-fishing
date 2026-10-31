using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Daily quests laid out like draft npc-gorev: balances top right, a header line, one card per quest
    /// (icon, title, progress bar, count, reward line, state) and a chest card. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class QuestView : MonoBehaviour
    {
        [System.Serializable]
        public sealed class Row
        {
            public GameObject root;
            public SlotView icon;
            public Text title, count, reward, state;
            public RectTransform fill;
            public Button button;
            public Text buttonText;
        }

        public WindowView window;
        public Text coin, diamond, header, hint, footer;
        public Row[] quests;
        public Row chest;
        /// <summary>npc-gorev: green when done, yellow while going.</summary>
        public Sprite barDone, barGoing;

        public void SetBar(Row row, float fill)
        {
            HudView.Fill(row.fill, fill);
            var img = row.fill.GetComponent<Image>();
            var sprite = fill >= 1f ? barDone : barGoing;
            if (img.sprite != sprite) img.sprite = sprite;
        }
    }
}
