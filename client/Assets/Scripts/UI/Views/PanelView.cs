using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// A generic kit window for list-shaped screens (trade, market, quests, settings...): header
    /// line, optional tabs, one to three scrolling columns of <see cref="RowView"/>s, a footer line
    /// and footer buttons / inputs. The builder sets size and column count per window; code fills
    /// rows. Rebuilding rows every change is fine for these small lists.
    /// </summary>
    public sealed class PanelView : MonoBehaviour
    {
        public WindowView window;
        public Text header;
        public Text headerRight;
        public RectTransform tabs;
        public Button tabTemplate;
        public Text[] columnTitles;
        public RectTransform[] columns;
        public RowView rowTemplate;
        public Text footer;
        public RectTransform footerBar;
        public Button wood, green, red;
        public InputField input;

        readonly List<GameObject> spawned = new List<GameObject>();
        readonly List<GameObject> footerSpawned = new List<GameObject>();
        readonly List<GameObject> tabSpawned = new List<GameObject>();

        public bool Open
        {
            get => window.Open;
            set => window.Open = value;
        }

        /// <summary>Removes every row (all columns).</summary>
        public void ClearRows()
        {
            foreach (var go in spawned) Destroy(go);
            spawned.Clear();
        }

        public RowView Row(int column = 0)
        {
            var r = Instantiate(rowTemplate, columns[Mathf.Clamp(column, 0, columns.Length - 1)], false);
            r.gameObject.SetActive(true);
            r.mark.gameObject.SetActive(false);
            r.sub.gameObject.SetActive(false);
            r.bar.gameObject.SetActive(false);
            r.right.gameObject.SetActive(false);
            spawned.Add(r.gameObject);
            return r;
        }

        /// <summary>A plain text line in a column (no card).</summary>
        public Text Line(string text, int column = 0, bool faint = true)
        {
            var t = Instantiate(faint ? footer : header, columns[Mathf.Clamp(column, 0, columns.Length - 1)], false);
            t.gameObject.SetActive(true);
            t.text = text;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            spawned.Add(t.gameObject);
            return t;
        }

        public void ColumnTitle(int column, string text)
        {
            if (columnTitles == null || column >= columnTitles.Length || columnTitles[column] == null) return;
            columnTitles[column].text = text;
        }

        public void ClearFooter()
        {
            foreach (var go in footerSpawned) Destroy(go);
            footerSpawned.Clear();
        }

        public Button FooterButton(string label, string style, Action action, float width = 110)
        {
            var template = style == "green" ? green : style == "red" ? red : wood;
            var b = Instantiate(template, footerBar, false);
            b.gameObject.SetActive(true);
            b.GetComponentInChildren<Text>().text = label;
            b.interactable = action != null;
            if (action != null) b.onClick.AddListener(() => action());
            b.GetComponent<LayoutElement>().preferredWidth = width;
            footerSpawned.Add(b.gameObject);
            return b;
        }

        public InputField FooterInput(string value, float width, Action<string> changed, int limit, bool digitsOnly, string placeholder = "")
        {
            var f = Instantiate(input, footerBar, false);
            f.gameObject.SetActive(true);
            f.characterLimit = limit;
            f.contentType = digitsOnly ? InputField.ContentType.IntegerNumber : InputField.ContentType.Standard;
            f.text = value ?? "";
            if (f.placeholder is Text ph) ph.text = placeholder;
            f.GetComponent<LayoutElement>().preferredWidth = width;
            if (changed != null) f.onValueChanged.AddListener(v => changed(v));
            footerSpawned.Add(f.gameObject);
            return f;
        }

        public void FooterSpace()
        {
            var go = new GameObject("Space", typeof(RectTransform), typeof(LayoutElement));
            go.transform.SetParent(footerBar, false);
            go.GetComponent<LayoutElement>().flexibleWidth = 1;
            footerSpawned.Add(go);
        }

        /// <summary>Replaces the tab buttons; the selected one uses the active tab look.</summary>
        public void Tabs(string[] labels, int selected, Action<int> pick)
        {
            foreach (var go in tabSpawned) Destroy(go);
            tabSpawned.Clear();
            tabs.gameObject.SetActive(labels != null && labels.Length > 0);
            if (labels == null) return;
            for (var i = 0; i < labels.Length; i++)
            {
                var b = Instantiate(tabTemplate, tabs, false);
                b.gameObject.SetActive(true);
                b.GetComponentInChildren<Text>().text = labels[i];
                var img = b.GetComponent<Image>();
                var tab = b.GetComponent<TabSprites>();
                if (tab != null) img.sprite = i == selected ? tab.active : tab.inactive;
                b.GetComponentInChildren<Text>().color = i == selected ? tab.activeText : tab.inactiveText;
                var index = i;
                b.onClick.AddListener(() => pick(index));
                tabSpawned.Add(b.gameObject);
            }
        }
    }
}
