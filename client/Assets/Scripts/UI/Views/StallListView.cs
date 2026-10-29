using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// One stall's full list, draft tezgah-tezgah: owner line with Profil / Fısılda / Arkadaş, 4x3 slots
    /// with price tags, and a detail card (price, how many, total, Satın al). Made by UiPrefabBuilder.
    /// </summary>
    public sealed class StallListView : MonoBehaviour
    {
        public WindowView window;
        public SlotView pet;
        public Text title, owner;
        public Button profile, whisper, friend;
        public SlotView[] slots;
        public PriceTag[] tags;
        public GameObject detail;
        public SlotView detailSlot;
        public Text detailName, detailSub, unitPrice, total, countLabel;
        public Button minus, plus, max, buy;
        public InputField count;
        public GameObject countRow;
        public Text buyText, note, footer;
    }
}
