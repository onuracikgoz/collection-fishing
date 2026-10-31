using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// The tooltip card and the click menu, drawn above every window; one copy, any window asks it.
    /// Both share one look (31.10.2026, Onur: the old box was cramped): a roomy dark card, the title
    /// on top, a coloured line under it (Tier), a rule, then label / value rows (tooltip) or the
    /// actions (menu), a faint note at the bottom. Made by UiPrefabBuilder.
    ///
    /// The menu closes on a click anywhere outside it and on Esc. (Bug, 31.10.2026: it stayed open
    /// unseen after a click elsewhere, and an open menu blocks the tooltip, so hovering showed nothing.)
    /// </summary>
    public sealed class PopupView : MonoBehaviour
    {
        /// <summary>What a tooltip card shows. Only title is needed.</summary>
        public struct Card
        {
            public string title, sub, note;
            public Color? subColour;
            public (string label, string value)[] rows;
        }

        [Header("Tooltip")]
        public RectTransform tooltip;
        public Text tooltipTitle, tooltipSub, tooltipNote;
        public GameObject tooltipRule;
        public RectTransform tooltipRows;
        public PopupRow rowTemplate;

        [Header("Menu")]
        public RectTransform menu;
        public Text menuTitle, menuSub;
        public Button itemTemplate;

        readonly List<Button> items = new List<Button>();
        readonly List<PopupRow> rows = new List<PopupRow>();
        static readonly Color Disabled = new Color32(0x7f, 0x70, 0x8a, 255);

        void Awake()
        {
            tooltip.gameObject.SetActive(false);
            menu.gameObject.SetActive(false);
            itemTemplate.gameObject.SetActive(false);
            rowTemplate.gameObject.SetActive(false);
        }

        int openedFrame = -1;

        void Update()
        {
            if (!menu.gameObject.activeSelf || Time.frameCount == openedFrame) return;
            var mouse = Mouse.current;
            var k = Keyboard.current;
            if (k != null && k.escapeKey.wasPressedThisFrame)
            {
                HideMenu();
                return;
            }
            if (mouse == null) return;
            var pressed = mouse.leftButton.wasPressedThisFrame || mouse.rightButton.wasPressedThisFrame;
            if (pressed && !RectTransformUtility.RectangleContainsScreenPoint(menu, mouse.position.ReadValue(), null)) HideMenu();
        }

        RectTransform Canvas => (RectTransform)transform.parent;

        /// <summary>Canvas position of the mouse (canvas units, origin bottom left of the canvas).</summary>
        Vector2 MouseLocal()
        {
            var mouse = Mouse.current;
            var screen = mouse != null ? mouse.position.ReadValue() : Vector2.zero;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(Canvas, screen, null, out var local);
            return local - Canvas.rect.min;
        }

        void Place(RectTransform box)
        {
            transform.SetAsLastSibling();
            LayoutRebuilder.ForceRebuildLayoutImmediate(box);
            var at = MouseLocal() + new Vector2(16f, -12f);
            var size = box.rect.size;
            var area = Canvas.rect.size;
            if (at.x + size.x > area.x - 4f) at.x = MouseLocal().x - size.x - 12f; // flip to the left of the pointer
            at.x = Mathf.Max(4f, at.x);
            at.y = Mathf.Clamp(at.y, size.y + 4f, area.y - 4f);
            box.anchorMin = box.anchorMax = Vector2.zero;
            box.pivot = new Vector2(0f, 1f);
            box.anchoredPosition = new Vector2(Mathf.Round(at.x), Mathf.Round(at.y));
        }

        public void ShowTooltip(Card card)
        {
            if (menu.gameObject.activeSelf) return;
            tooltipTitle.text = card.title ?? "";
            Line(tooltipSub, card.sub, card.subColour);
            Line(tooltipNote, card.note, null);
            var list = card.rows ?? Array.Empty<(string, string)>();
            while (rows.Count < list.Length)
            {
                var r = Instantiate(rowTemplate, tooltipRows, false);
                r.name = "Row";
                rows.Add(r);
            }
            for (var i = 0; i < rows.Count; i++)
            {
                var on = i < list.Length;
                rows[i].gameObject.SetActive(on);
                if (!on) continue;
                rows[i].label.text = list[i].label;
                rows[i].value.text = list[i].value;
            }
            tooltipRows.gameObject.SetActive(list.Length > 0);
            tooltipRule.SetActive(list.Length > 0 || !string.IsNullOrEmpty(card.note));
            tooltip.gameObject.SetActive(true);
            Place(tooltip);
        }

        /// <summary>Plain text tooltip: the first line is the title, the rest a note.</summary>
        public void ShowTooltip(string text)
        {
            text ??= "";
            var cut = text.IndexOf('\n');
            ShowTooltip(new Card { title = cut < 0 ? text : text.Substring(0, cut), note = cut < 0 ? null : text.Substring(cut + 1) });
        }

        public void HideTooltip() => tooltip.gameObject.SetActive(false);

        static void Line(Text t, string s, Color? colour)
        {
            var on = !string.IsNullOrEmpty(s);
            t.gameObject.SetActive(on);
            if (!on) return;
            t.text = s;
            if (colour.HasValue) t.color = colour.Value;
        }

        /// <summary>A click menu: (label, action or null for a greyed-out line).</summary>
        public void ShowMenu(string title, IEnumerable<(string label, Action action)> entries) => ShowMenu(title, null, null, entries);

        /// <summary>A click menu with a coloured line under the title (the item's Tier).</summary>
        public void ShowMenu(string title, string sub, Color? subColour, IEnumerable<(string label, Action action)> entries)
        {
            HideTooltip();
            foreach (var b in items) Destroy(b.gameObject);
            items.Clear();
            menuTitle.text = title ?? "";
            Line(menuSub, sub, subColour);
            foreach (var (label, action) in entries)
            {
                var b = Instantiate(itemTemplate, itemTemplate.transform.parent, false);
                b.gameObject.SetActive(true);
                var text = b.GetComponentInChildren<Text>();
                text.text = label;
                b.interactable = action != null;
                if (action == null) text.color = Disabled;
                var act = action;
                b.onClick.AddListener(() =>
                {
                    HideMenu();
                    act?.Invoke();
                });
                items.Add(b);
            }
            menu.gameObject.SetActive(true);
            openedFrame = Time.frameCount;
            Place(menu);
        }

        public void HideMenu()
        {
            menu.gameObject.SetActive(false);
            // A button of the closed menu may still be "selected": let go so the next hover works.
            if (EventSystem.current != null) EventSystem.current.SetSelectedGameObject(null);
        }

        public bool MenuOpen => menu.gameObject.activeSelf;
    }
}
