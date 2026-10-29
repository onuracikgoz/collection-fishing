using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// The HUD of draft hud3: place box top left, balances top right, XP strip and the flat sage
    /// bottom bar (energy, rod, bait, chat line, window buttons) with the chat log above it.
    /// Only references; World/WorldHud.cs fills them. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class HudView : MonoBehaviour
    {
        [Header("Top")]
        public Text place;
        public Text info;
        public Text score, coin, diamond;

        [Header("XP")]
        public Text level;
        public RectTransform xpFill;
        public Text xpText;

        [Header("Bottom bar")]
        public RectTransform energyFill;
        public Text energyText;
        public RectTransform rodFill;
        public Image rodFillImage;
        public Sprite rodGood, rodLow;
        public Text rodText;
        public SlotView bait;
        public Text baitText;
        public InputField chat;
        public Button send;
        public Text chatLog;

        [Header("Window buttons")]
        public Button quests;
        public Button market;
        public Button friends;
        public Button profile;
        public Button book;
        public Button bag;
        public Button settings;
        public GameObject questsAlert;

        /// <summary>Sets a fill bar's width: anchors (0,0)-(fill,1) inside its back.</summary>
        public static void Fill(RectTransform bar, float fill)
        {
            if (bar == null) return;
            bar.anchorMax = new Vector2(Mathf.Clamp01(fill), 1f);
        }
    }
}
