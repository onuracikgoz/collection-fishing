using System;
using System.Collections.Generic;
using CollectionGame.Economy;
using CollectionGame.Fishing;
using CollectionGame.Net;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Item inspect window (01.11.2026, Onur: like the CS2 inspect screen, flat because the game is 2D):
    /// the item's picture large in its Tier frame, then name, Tier and set, the Float on a condition bar,
    /// where it came from, and the item's story. Opens from the bag and the book. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class InspectView : MonoBehaviour
    {
        public WindowView window;
        public GameObject dim;
        public Button dimButton;
        public Image frame, icon;
        /// <summary>slot_tier_common..mythic (Tiers.All order); empty is the frame of an item with no Tier.</summary>
        public Sprite[] tierFrames;
        public Sprite empty;
        public Text itemName, tier;
        /// <summary>Float value, condition bar, condition and origin; hidden for a found record with no copy.</summary>
        public GameObject floatGroup;
        public Text floatValue, condition, origin;
        public RectTransform floatBar, floatMarker;
        public Image segmentTemplate;
        /// <summary>Shown instead of the Float part when there is no copy to inspect.</summary>
        public Text emptyNote;
        public RectTransform storyPanel;
        public Text story;

        /// <summary>Window height without the story panel; the panel adds its own height plus the gaps.</summary>
        public float baseHeight = 496, storyTop = 490, storyPad = 44, storyMax = 160;

        /// <summary>Condition colours, best to worst (pristine → damaged).</summary>
        static readonly Color[] ConditionColours =
        {
            new Color32(0x1e, 0x6f, 0x50, 0xff), new Color32(0x5a, 0xb5, 0x52, 0xff), new Color32(0xf9, 0xc2, 0x2b, 0xff),
            new Color32(0xf7, 0x96, 0x17, 0xff), new Color32(0xe8, 0x3b, 0x3b, 0xff),
        };

        static readonly string[] ConditionOrder = { "pristine", "excellent", "normal", "worn", "damaged" };

        readonly List<Image> segments = new List<Image>();
        string shownDefId;
        ItemInstance shownItem;
        int locVersion;

        void Awake()
        {
            window.Closed = Close;
            if (dimButton != null) dimButton.onClick.AddListener(Close);
            if (segmentTemplate != null) segmentTemplate.gameObject.SetActive(false);
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
            if (locVersion != Loc.Version) Fill(); // language changed: the labels and the story change too
        }

        /// <summary>Opens on an item: a copy (Float, origin) or only a defId (a found record whose slot is empty).</summary>
        public void Show(string defId, ItemInstance item)
        {
            shownDefId = item != null ? item.defId : defId;
            shownItem = item;
            dim.SetActive(true);
            window.Open = true;
            transform.SetAsLastSibling();
            Fill();
        }

        public void Close()
        {
            shownItem = null;
            shownDefId = null;
            dim.SetActive(false);
            window.Open = false;
        }

        void Fill()
        {
            locVersion = Loc.Version;
            var it = shownItem;
            var defId = shownDefId;
            var tierId = it != null ? it.tier : ItemContent.Tier(defId);
            var rank = Tiers.Rank(tierId);

            frame.sprite = rank >= 0 && tierFrames != null && rank < tierFrames.Length ? tierFrames[rank] : empty;
            // a copy shows its Float on the picture (FloatLook: mud, scratches, sparkles, light streak)
            FloatLook.Clear(icon);
            var sprite = ItemIcons.For(defId);
            icon.sprite = sprite;
            icon.enabled = sprite != null;
            if (it != null) FloatLook.Apply(icon, it);
            icon.preserveAspect = true;
            icon.color = it != null || ItemContent.Icon(defId) != null ? Color.white : new Color(1f, 1f, 1f, 0.85f);

            itemName.text = FishingController.ItemName(defId);
            var set = ItemContent.SetName(ItemContent.SetOf(defId));
            var tierName = ItemText.TierName(tierId);
            tier.text = string.IsNullOrEmpty(set) ? tierName : string.IsNullOrEmpty(tierName) ? set : $"{tierName} · {set}";
            tier.color = rank >= 0 ? ItemText.TierColour(tierId) : Faint;

            floatGroup.SetActive(it != null);
            emptyNote.gameObject.SetActive(it == null);
            if (it != null) FillFloat(it);
            else emptyNote.text = Loc.T("book.found_empty");

            FillStory(defId);
        }

        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);

        void FillFloat(ItemInstance it)
        {
            var f = Mathf.Clamp01(it.@float);
            floatValue.text = it.@float.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture);
            var prices = PricesSource?.Invoke();
            BuildSegments(prices?.Catalog?.conditions);
            floatMarker.anchorMin = floatMarker.anchorMax = new Vector2(f, 0.5f);
            floatMarker.anchoredPosition = Vector2.zero;

            var cond = prices != null ? prices.ConditionOf(it.@float) : "";
            condition.text = string.IsNullOrEmpty(cond) ? "-" : Prices.ConditionName(cond);

            var parts = new List<string> { Loc.T("inspect.source." + (string.IsNullOrEmpty(it.source) ? "fishing" : it.source)) };
            if (it.obtainedAt > 0)
                parts.Add(DateTimeOffset.FromUnixTimeMilliseconds(it.obtainedAt).ToLocalTime().ToString("d", Loc.Culture));
            if (it.locked) parts.Add(Loc.T("item.locked"));
            origin.text = string.Join(" · ", parts);
        }

        /// <summary>One coloured piece per condition band of the catalog (min..max of the Float); one plain bar without a catalog.</summary>
        void BuildSegments(CatalogCondition[] bands)
        {
            var count = bands != null && bands.Length > 0 ? bands.Length : 1;
            while (segments.Count < count)
            {
                var s = Instantiate(segmentTemplate, floatBar, false);
                s.transform.SetSiblingIndex(segmentTemplate.transform.GetSiblingIndex());
                segments.Add(s);
            }
            for (var i = 0; i < segments.Count; i++)
            {
                var s = segments[i];
                s.gameObject.SetActive(i < count);
                if (i >= count) continue;
                float min = 0, max = 1;
                var colour = new Color(1f, 1f, 1f, 0.25f);
                if (bands != null && bands.Length > 0)
                {
                    min = Mathf.Clamp01(bands[i].min);
                    max = Mathf.Clamp01(bands[i].max);
                    var c = Array.IndexOf(ConditionOrder, bands[i].condition);
                    colour = ConditionColours[c >= 0 ? c : Mathf.Clamp(i, 0, ConditionColours.Length - 1)];
                }
                var rt = (RectTransform)s.transform;
                rt.anchorMin = new Vector2(min, 0);
                rt.anchorMax = new Vector2(max, 1);
                rt.offsetMin = new Vector2(0, 2); // inside the bar's frame
                rt.offsetMax = new Vector2(0, -2);
                s.color = colour;
            }
            floatMarker.SetAsLastSibling();
        }

        /// <summary>
        /// The story is a text of the language files (key item.story.&lt;id&gt;, written in the admin panel,
        /// sent by get_locale). No text in any language: the panel hides and the window gets shorter.
        /// </summary>
        void FillStory(string defId)
        {
            var key = "item.story." + defId;
            var text = !string.IsNullOrEmpty(defId) && Loc.Has(key) ? Loc.T(key) : "";
            var has = !string.IsNullOrEmpty(text) && text != key;
            storyPanel.gameObject.SetActive(has);
            var rt = (RectTransform)window.transform;
            if (!has)
            {
                rt.sizeDelta = new Vector2(rt.sizeDelta.x, baseHeight);
                return;
            }
            story.text = text;
            Canvas.ForceUpdateCanvases();
            var textHeight = Mathf.Clamp(story.preferredHeight, 16, storyMax);
            var srt = (RectTransform)story.transform;
            srt.sizeDelta = new Vector2(srt.sizeDelta.x, textHeight);
            storyPanel.sizeDelta = new Vector2(storyPanel.sizeDelta.x, textHeight + storyPad);
            rt.sizeDelta = new Vector2(rt.sizeDelta.x, storyTop + textHeight + storyPad + 16);
        }

        // ----- one shared window -----

        static InspectView shared;

        /// <summary>The catalog's condition bands (set by WorldController); null until get_catalog answered.</summary>
        public static Func<Prices> PricesSource;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics()
        {
            shared = null;
            PricesSource = null;
        }

        /// <summary>Opens the inspect window, made on first use.</summary>
        public static void Open(string defId, ItemInstance item = null)
        {
            if (string.IsNullOrEmpty(defId) && item == null) return;
            if (shared == null) shared = UiRoot.Get().Spawn<InspectView>("Inspect");
            if (shared == null) return;
            shared.Show(defId, item);
        }

        public static bool IsOpen => shared != null && shared.window.Open;
    }
}
