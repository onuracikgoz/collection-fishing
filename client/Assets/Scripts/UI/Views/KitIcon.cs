using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Puts a placeholder picture from ItemIcons (drawn at runtime, so not in the prefab) on an Image:
    /// HUD buttons, the bag's trash can, the chat grip. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class KitIcon : MonoBehaviour
    {
        public Image image;
        public string key;

        void Awake() => Apply();

        public void Apply()
        {
            if (image == null || string.IsNullOrEmpty(key)) return;
            image.sprite = ItemIcons.For(key);
            image.enabled = image.sprite != null;
        }
    }
}
