using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>"Yeni keşif!" and "Daha temiz kopya!" boxes of drafts balik-kesif / balik-temiz. Made by UiPrefabBuilder.</summary>
    public sealed class CatchView : MonoBehaviour
    {
        [Header("Yeni keşif")]
        public WindowView discover;
        public SlotView discoverSlot;
        public Text discoverName, discoverTier, discoverFloat, discoverPage, discoverNote;
        public RectTransform discoverFill;

        [Header("Daha temiz kopya")]
        public WindowView swap;
        public SlotView oldSlot, newSlot;
        public Text oldFloat, oldCondition, newFloat, newCondition, swapCaption;
        public Button swapYes, swapNo;
    }
}
