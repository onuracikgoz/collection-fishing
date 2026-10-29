using System;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>A scrolling grid of 40 px slots cloned from a template (bag, stash).</summary>
    [Serializable]
    public sealed class SlotGrid
    {
        public RectTransform content;
        public SlotView template;
    }

    /// <summary>One line of the sell / salvage basket (npc-sat, npc-parcala).</summary>
    [Serializable]
    public sealed class BasketLine
    {
        public GameObject root;
        public SlotView icon;
        public Text name, value;
        public Image valueIcon;
        public CardHover hover;
    }

    /// <summary>One special bait row of the shop tab.</summary>
    [Serializable]
    public sealed class BaitRow
    {
        public GameObject root;
        public SlotView icon;
        public Text name, info, count;
        public Button minus, plus, buy, use;
        public Text buyText, useText;
    }
}
