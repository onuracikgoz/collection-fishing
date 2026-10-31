using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Puts the placeholder trash can picture (ItemIcons) on the bag's trash button at runtime.</summary>
    public sealed class TrashIcon : MonoBehaviour
    {
        public Image icon;

        void Awake()
        {
            if (icon != null) icon.sprite = ItemIcons.For("trash");
        }
    }
}
