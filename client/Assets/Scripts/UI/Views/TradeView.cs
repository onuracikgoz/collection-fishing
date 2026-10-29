using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Trade window of drafts takas-a / b / c: two sides (me, them), each with 8 slots, a count,
    /// a Coin field and a status line; a hint or countdown strip; Kilitle / Onayla / İptal.
    /// Made by UiPrefabBuilder.
    /// </summary>
    public sealed class TradeView : MonoBehaviour
    {
        [System.Serializable]
        public sealed class Side
        {
            public Image back;
            public Text name, level, count, status;
            public SlotView[] slots;
            public InputField coin;
        }

        public WindowView window;
        public Side me, them;
        public Sprite open, locked;
        public Text hint;
        public GameObject strip;
        public Text stripText;
        public Button lockButton, confirm, cancel;
        public Text lockText, confirmText;
        public Sprite confirmReady, confirmWaiting;
    }
}
