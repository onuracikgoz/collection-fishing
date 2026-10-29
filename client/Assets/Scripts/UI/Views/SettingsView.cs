using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Settings window laid out like drafts ayarlar-genel / ayarlar-hesap: tab column on the left
    /// (Genel, Hesap, version under them), sections with dividers on the right. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class SettingsView : MonoBehaviour
    {
        public WindowView window;
        public TabButton tabGeneral, tabAccount;
        public Text version;
        public GameObject general, account;

        [Header("Genel")]
        public Slider music, effects;
        public Text musicValue, effectsValue;
        public Toggle hitSound, fullScreen, showNames, friendsOnly, announcements, bubbles;
        public Button language, uiScale;
        public Text languageText, uiScaleText;
        public Text blocked;
        public Button openBlocked;

        [Header("Hesap")]
        public GameObject hidden;
        public Button reveal;
        public LoginRow google, facebook, discord, steam;
        public GameObject codeBox;
        public Text code, codeTimer;
        public Text username;
        public Button logout, delete;
        public Text deleteNote;
        public GameObject confirm;
        public InputField confirmName;
        public Button confirmDelete, confirmCancel;
        public Text pending;
        public Button cancelDeletion;
        public Text error;

        /// <summary>One login method row: icon, name, status, one button.</summary>
        [System.Serializable]
        public sealed class LoginRow
        {
            public Image back;
            public Text status;
            public Button button;
            public Text buttonText;
        }

    }
}
