using System;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>"Kaç tane?" dialog of draft takas-b: minus, number, plus, Tamam / Vazgeç. Made by UiPrefabBuilder.</summary>
    public sealed class CountView : MonoBehaviour
    {
        public WindowView window;
        public GameObject dim;
        public Text question;
        public Button minus, plus, ok, cancel;
        public InputField value;

        int max = 1;
        Action<int> done;

        void Awake()
        {
            minus.onClick.AddListener(() => Set(Read() - 1));
            plus.onClick.AddListener(() => Set(Read() + 1));
            ok.onClick.AddListener(() =>
            {
                var n = Read();
                Close();
                done?.Invoke(n);
            });
            cancel.onClick.AddListener(Close);
            window.Closed = Close;
        }

        int Read() => Mathf.Clamp(int.TryParse(value.text, out var n) ? n : 1, 1, max);
        void Set(int n) => value.text = Mathf.Clamp(n, 1, max).ToString();

        /// <summary>Asks for a number in 1..max; done gets the answer.</summary>
        public void Ask(string text, int start, int maxCount, Action<int> answer)
        {
            max = Mathf.Max(1, maxCount);
            done = answer;
            question.text = text;
            Set(start);
            window.Open = true;
            if (dim != null) dim.SetActive(true);
        }

        public void Close()
        {
            window.Open = false;
            if (dim != null) dim.SetActive(false);
        }
    }
}
