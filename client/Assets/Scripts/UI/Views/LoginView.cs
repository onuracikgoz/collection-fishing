using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// The way into the game, drafts _akis-1..7: title, "Oyuna gir", character name, server list, loading.
    /// Steam screens (_akis-3, _akis-4) wait for the Steam build. Made by UiPrefabBuilder; Game.cs drives it.
    /// </summary>
    public sealed class LoginView : MonoBehaviour
    {
        [System.Serializable]
        public sealed class ServerRow
        {
            public GameObject root;
            public Image back, flag;
            public Text name, friends, count, warn;
            public RectTransform fill;
            public Image fillImage;
            public Button go;
        }

        public GameObject titlePlate;
        public GameObject title;
        public Button play, settings;
        public WindowView host;
        public InputField hostField;
        public Button hostSave;
        public WindowView guest;
        public Button guestPlay;
        public Button[] social;
        public WindowView character;
        public InputField nameField;
        public Button back, next;
        public WindowView servers;
        public Text greeting;
        public ServerRow[] rows;
        public Button refresh, logout;
        public Sprite rowFriends, rowPlain, fillGreen, fillYellow, fillRed, flagTr, flagEn;
        public GameObject loading;
        public Text loadingText, tip;
        public RectTransform loadingFill;
        public Text error, version, credits;
    }
}
