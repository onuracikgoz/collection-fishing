using System;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// One row of a panel list (kit card): an optional slot mark, a title, a small line under it,
    /// an optional progress bar, a right-hand value, and any number of inputs and buttons cloned
    /// from hidden templates. Made by UiPrefabBuilder; filled by code.
    /// </summary>
    public sealed class RowView : MonoBehaviour
    {
        public SlotView mark;
        public Text title;
        public Text sub;
        public RectTransform bar;
        public RectTransform barFill;
        public Text right;
        public RectTransform tail;
        public Button wood, green, red;
        public InputField input;

        public RowView Mark(string defId, string tier, int count = 1, bool locked = false)
        {
            mark.gameObject.SetActive(true);
            if (string.IsNullOrEmpty(defId)) mark.SetEmpty();
            else mark.SetItem(defId, tier, count, locked);
            return this;
        }

        public RowView Title(string text)
        {
            title.text = text;
            return this;
        }

        public RowView Sub(string text)
        {
            sub.gameObject.SetActive(!string.IsNullOrEmpty(text));
            sub.text = text ?? "";
            return this;
        }

        public RowView Right(string text, Color? colour = null)
        {
            right.gameObject.SetActive(!string.IsNullOrEmpty(text));
            right.text = text ?? "";
            if (colour.HasValue) right.color = colour.Value;
            return this;
        }

        public RowView Bar(float fill)
        {
            bar.gameObject.SetActive(true);
            HudView.Fill(barFill, fill);
            return this;
        }

        /// <summary>style: wood, green or red. A null action greys the button out.</summary>
        public Button Button(string label, string style, Action action, float width = 0)
        {
            var template = style == "green" ? green : style == "red" ? red : wood;
            var b = Instantiate(template, tail, false);
            b.gameObject.SetActive(true);
            b.GetComponentInChildren<Text>().text = label;
            b.interactable = action != null;
            if (action != null) b.onClick.AddListener(() => action());
            if (width > 0) b.GetComponent<LayoutElement>().preferredWidth = width;
            return b;
        }

        public InputField Input(string value, float width, Action<string> changed, int limit = 10, bool digitsOnly = true)
        {
            var f = Instantiate(input, tail, false);
            f.gameObject.SetActive(true);
            f.characterLimit = limit;
            f.contentType = digitsOnly ? InputField.ContentType.IntegerNumber : InputField.ContentType.Standard;
            f.text = value ?? "";
            f.GetComponent<LayoutElement>().preferredWidth = width;
            if (changed != null) f.onValueChanged.AddListener(v => changed(v));
            return f;
        }

        public Text Note(string text)
        {
            var t = Instantiate(right, tail, false);
            t.gameObject.SetActive(true);
            t.text = text;
            return t;
        }
    }
}
