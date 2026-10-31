using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// The one tab of the game (Ayarlar, Arkadaşlar, Tüccar, Zanaatkar...). Its looks come from
    /// UiPrefabBuilder.Tab: selected = kit button_wood_normal, unselected = kit tab_off. Change them
    /// there (or the kit) and every window follows after a rebuild.
    /// </summary>
    public sealed class TabButton : MonoBehaviour
    {
        public Button button;
        public Image image;
        public Text label;
        public Sprite on, off;
        public Color onText, offText;

        public void Set(bool selected)
        {
            image.sprite = selected ? on : off;
            label.color = selected ? onText : offText;
        }
    }
}
