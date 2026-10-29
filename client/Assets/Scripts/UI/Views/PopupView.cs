using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// The tooltip (kit tooltip) and the right-click menu (kit menu + menu_highlight), drawn above
    /// every window. One copy; any window asks it to show. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class PopupView : MonoBehaviour
    {
        public RectTransform tooltip;
        public Text tooltipText;
        public RectTransform menu;
        public Text menuTitle;
        public Button itemTemplate;

        readonly List<Button> items = new List<Button>();

        void Awake()
        {
            tooltip.gameObject.SetActive(false);
            menu.gameObject.SetActive(false);
            itemTemplate.gameObject.SetActive(false);
        }

        RectTransform Canvas => (RectTransform)transform.parent;

        /// <summary>Canvas position of the mouse (canvas units, origin bottom left of the canvas).</summary>
        Vector2 MouseLocal()
        {
            var mouse = UnityEngine.InputSystem.Mouse.current;
            var screen = mouse != null ? mouse.position.ReadValue() : Vector2.zero;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(Canvas, screen, null, out var local);
            return local - Canvas.rect.min;
        }

        void Place(RectTransform box)
        {
            transform.SetAsLastSibling();
            LayoutRebuilder.ForceRebuildLayoutImmediate(box);
            var at = MouseLocal() + new Vector2(14f, -10f);
            var size = box.rect.size;
            var area = Canvas.rect.size;
            at.x = Mathf.Min(at.x, area.x - size.x - 4f);
            at.y = Mathf.Max(at.y, size.y + 4f);
            box.anchorMin = box.anchorMax = Vector2.zero;
            box.pivot = new Vector2(0f, 1f);
            box.anchoredPosition = new Vector2(Mathf.Round(at.x), Mathf.Round(at.y));
        }

        public void ShowTooltip(string text)
        {
            if (menu.gameObject.activeSelf) return;
            tooltipText.text = text;
            tooltip.gameObject.SetActive(true);
            Place(tooltip);
        }

        public void HideTooltip() => tooltip.gameObject.SetActive(false);

        /// <summary>A right-click menu: (label, action or null for a greyed-out line).</summary>
        public void ShowMenu(string title, IEnumerable<(string label, Action action)> entries)
        {
            HideTooltip();
            foreach (var b in items) Destroy(b.gameObject);
            items.Clear();
            menuTitle.text = title;
            foreach (var (label, action) in entries)
            {
                var b = Instantiate(itemTemplate, itemTemplate.transform.parent, false);
                b.gameObject.SetActive(true);
                b.GetComponentInChildren<Text>().text = label;
                b.interactable = action != null;
                var act = action;
                b.onClick.AddListener(() =>
                {
                    HideMenu();
                    act?.Invoke();
                });
                items.Add(b);
            }
            menu.gameObject.SetActive(true);
            Place(menu);
        }

        public void HideMenu() => menu.gameObject.SetActive(false);

        public bool MenuOpen => menu.gameObject.activeSelf;
    }
}
