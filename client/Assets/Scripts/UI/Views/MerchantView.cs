using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Balıkçı Tüccar of drafts npc-sat / npc-parcala (tabs Sat, Parçala, Dükkan, Görevler): bag grid on
    /// the left, the basket on the right, one big Sat / Parçala button. Dükkan: rod repair and special
    /// baits (no draft; same frame). Made by UiPrefabBuilder.
    /// </summary>
    public sealed class MerchantView : MonoBehaviour
    {
        public WindowView window;
        public Button[] tabs;
        public Text[] tabTexts;
        public Sprite tabOn, tabOff;
        public Text coin, dust;
        public Image dustIcon;

        [Header("Sat / Parçala")]
        public GameObject sell;
        public SlotGrid bag;
        public Text bagHint;
        public Text basketTitle;
        public BasketLine[] lines;
        public Text more, totalValue, note;
        public Image totalIcon;
        public Button sellButton, salvageButton;
        public Text sellText, salvageText;
        public Sprite coinMark, dustMark;

        [Header("Dükkan")]
        public GameObject shop;
        public Text rodText;
        public RectTransform rodFill;
        public Button repair;
        public Text repairText;
        public BaitRow[] baits;
    }
}
