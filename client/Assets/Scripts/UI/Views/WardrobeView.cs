using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Wardrobe window of draft gardirop (docs/gorsel/ui-taslaklar/gardirop.png): the try-on preview
    /// with turn buttons, identity (body, skin, eyes), family tabs, a page of parts, the chosen part's
    /// colours, and Geri al / Kaydet. Made by UiPrefabBuilder; filled by Wardrobe/WardrobeController.
    /// </summary>
    public sealed class WardrobeView : MonoBehaviour
    {
        public WindowView window;
        /// <summary>The character is drawn here, 64x64 art pixels at four layout units each.</summary>
        public RectTransform preview;
        public Button turnLeft, turnRight;
        public TabButton bodyMale, bodyFemale;
        public Button[] skins, eyes;
        public TabButton[] tabs;
        public SlotView[] parts;
        public Button prevPage, nextPage;
        public Text page;
        public Text partName, partTier, partInfo, colorNote;
        public Button[] colors;
        public Button prevColors, nextColors;
        public Button takeOff, revert, save;
        public Text changes;
    }
}
