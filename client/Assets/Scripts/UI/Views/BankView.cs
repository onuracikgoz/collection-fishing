using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Banka (stash) of draft npc-depo: stash grid, bag grid, expand card. Made by UiPrefabBuilder.</summary>
    public sealed class BankView : MonoBehaviour
    {
        public WindowView window;
        public Text stashTitle, stashCount, bagTitle, hint, footer;
        public SlotGrid stash, bag;
        public GameObject expand;
        public Text expandSlots, expandPrice;
        public Button expandButton;
        public Text expandText;
    }
}
