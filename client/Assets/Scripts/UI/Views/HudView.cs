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
        public Image flag;
        public Text coin, diamond, dust;
        /// <summary>Under the balances: the map around us and "Başlangıca dön".</summary>
        public MiniMapView miniMap;

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
        /// <summary>Green square next to the rod bar: opens the shop (rod repair).</summary>
        public Button repair;
        public SlotView bait;
        public Text baitText;
        public InputField chat;
        public Button send;
        public Text chatLog;
        public RectTransform chatLogBox;
        /// <summary>Chat line and send: always there.</summary>
        public GameObject chatGroup;
        /// <summary>On the log's top edge, see-through: the grip (drag to resize the log) and x (close it).</summary>
        public GameObject chatControls;
        public ChatResize chatGrip;
        public Button chatClose;
        /// <summary>Small button on the chat line's corner: opens a closed log; the red dot means unread lines.</summary>
        public Button chatOpen;
        public GameObject chatUnread;

        [Header("Window buttons")]
        public Button emote;
        public Button market;
        public Button friends;
        public Button profile;
        public Button book;
        public Button bag;
        public Button settings;

        /// <summary>Sets a fill bar's width: anchors (0,0)-(fill,1) inside its back.</summary>
        public static void Fill(RectTransform bar, float fill)
        {
            if (bar == null) return;
            bar.anchorMax = new Vector2(Mathf.Clamp01(fill), 1f);
        }
    }
}
