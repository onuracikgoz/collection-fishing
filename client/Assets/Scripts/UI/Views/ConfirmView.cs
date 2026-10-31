using System;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>"Emin misin?" box (31.10.2026, Onur: throwing an item away asks first). Made by UiPrefabBuilder.</summary>
    public sealed class ConfirmView : MonoBehaviour
    {
        public WindowView window;
        public GameObject dim;
        public Text title, text;
        public Button yes, no;
        public Text yesText;

        Action onYes;

        void Awake()
        {
            yes.onClick.AddListener(() =>
            {
                var a = onYes;
                Close();
                a?.Invoke();
            });
            no.onClick.AddListener(Close);
            window.Closed = Close;
            Close();
        }

        public void Ask(string titleText, string body, string yesLabel, Action then)
        {
            onYes = then;
            title.text = titleText;
            text.text = body;
            yesText.text = yesLabel;
            dim.SetActive(true);
            window.Open = true;
            transform.SetAsLastSibling();
        }

        public void Close()
        {
            onYes = null;
            dim.SetActive(false);
            window.Open = false;
        }

        static ConfirmView shared;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => shared = null;

        /// <summary>The one confirm box, made on first use.</summary>
        public static void Show(string titleText, string body, string yesLabel, Action then)
        {
            if (shared == null) shared = UiRoot.Get().Spawn<ConfirmView>("Confirm");
            if (shared == null) return;
            shared.Ask(titleText, body, yesLabel, then);
        }
    }
}
