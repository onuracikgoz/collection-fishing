using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Profile card laid out like draft profil-v3. Made by UiPrefabBuilder.</summary>
    public sealed class ProfileView : MonoBehaviour
    {
        public WindowView window;
        /// <summary>The player's character as it looks now (31.10.2026, Onur).</summary>
        public CharacterPortrait portrait;
        public Text displayName, level, sub, score;
        public GameObject levelTag, hunt;
        public Text huntText;
        public SlotView[] showcase;
        public Text stat1Label, stat1Value, stat2Label, stat2Value, stat3Label, stat3Value;
        public RectTransform stat1Fill;
        public Button book, whisper, friend, trade, report, block;
        public Text bookText, footer;
    }
}
