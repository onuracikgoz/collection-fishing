using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Info window (01.11.2026, Onur: windows had too much explaining text). Every window's "!" button
    /// opens this one box with that window's help: headed sections from Locales keys
    /// info.&lt;key&gt;.1.title / info.&lt;key&gt;.1.text, .2..., read until a title is missing.
    /// The box grows with its text up to a limit, then scrolls. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class InfoView : MonoBehaviour
    {
        public WindowView window;
        public GameObject dim;
        public Button dimButton;
        public RectTransform list;
        public ScrollRect scroll;
        public Text headingTemplate, textTemplate;
        /// <summary>Window height around the list (frame, padding) and the height limits.</summary>
        public float chrome = 56, minHeight = 160, maxHeight = 560;

        readonly List<GameObject> made = new List<GameObject>();
        string key, shownTitle;
        int locVersion = -1;

        void Awake()
        {
            window.Closed = Close;
            if (dimButton != null) dimButton.onClick.AddListener(Close);
            headingTemplate.gameObject.SetActive(false);
            textTemplate.gameObject.SetActive(false);
            Close();
        }

        void Update()
        {
            if (!window.Open) return;
            var k = Keyboard.current;
            if (k != null && k.escapeKey.wasPressedThisFrame)
            {
                Close();
                return;
            }
            if (locVersion != Loc.Version) Fill();
        }

        public void Show(string title, string infoKey)
        {
            key = infoKey;
            shownTitle = title;
            dim.SetActive(true);
            window.Open = true;
            transform.SetAsLastSibling();
            Fill();
        }

        public void Close()
        {
            key = null;
            dim.SetActive(false);
            window.Open = false;
        }

        void Fill()
        {
            locVersion = Loc.Version;
            window.title.text = string.IsNullOrEmpty(shownTitle) ? Loc.T("info.title") : shownTitle;
            foreach (var go in made)
            {
                go.SetActive(false); // out of the layout now; Destroy waits for the end of the frame
                Destroy(go);
            }
            made.Clear();
            for (var i = 1; i <= 20 && key != null; i++)
            {
                var head = $"info.{key}.{i}.title";
                if (!Loc.Has(head)) break;
                Add(headingTemplate, Loc.T(head));
                var body = $"info.{key}.{i}.text";
                if (Loc.Has(body)) Add(textTemplate, Loc.T(body));
            }

            // Grow with the text, scroll past the limit.
            LayoutRebuilder.ForceRebuildLayoutImmediate(list);
            var rt = (RectTransform)window.transform;
            var h = Mathf.Clamp(Mathf.Ceil(LayoutUtility.GetPreferredHeight(list)) + chrome, minHeight, maxHeight);
            rt.sizeDelta = new Vector2(rt.sizeDelta.x, h);
            if (scroll != null) scroll.verticalNormalizedPosition = 1f;
        }

        void Add(Text template, string text)
        {
            var t = Instantiate(template, template.transform.parent, false);
            t.text = text;
            t.gameObject.SetActive(true);
            made.Add(t.gameObject);
        }

        static InfoView shared;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => shared = null;

        /// <summary>Opens the one info box on a window's help, or closes it when it already shows that help.</summary>
        public static void Toggle(string title, string infoKey)
        {
            if (shared == null) shared = UiRoot.Get().Spawn<InfoView>("Info");
            if (shared == null) return;
            if (shared.window.Open && shared.key == infoKey) shared.Close();
            else shared.Show(title, infoKey);
        }
    }
}
