using CollectionGame.Economy;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI.Views;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>Item descriptions shared by every window: one-line texts and the tooltip card.</summary>
    public static class ItemText
    {
        static readonly Color[] TierColours =
        {
            new Color32(0x9b, 0xab, 0xb2, 0xff), new Color32(0x4d, 0x9b, 0xe6, 0xff), new Color32(0xa8, 0x84, 0xf3, 0xff),
            new Color32(0xf7, 0x96, 0x17, 0xff), new Color32(0xe8, 0x3b, 0x3b, 0xff),
        };

        /// <summary>The Tier's colour (the slot frame colours), white for no Tier.</summary>
        public static Color TierColour(string tier)
        {
            var r = Tiers.Rank(tier);
            return r >= 0 ? TierColours[r] : Color.white;
        }

        /// <summary>"rare" → "Rare" (Tier names stay English).</summary>
        public static string TierName(string tier) => string.IsNullOrEmpty(tier) ? "" : char.ToUpperInvariant(tier[0]) + tier.Substring(1);

        /// <summary>Tooltip card of a Float item: name, Tier, then Kondisyon / Float (and any extra rows), note.</summary>
        public static PopupView.Card Card(ItemInstance it, Prices prices, string note = null, params (string, string)[] extra)
        {
            var rows = new System.Collections.Generic.List<(string, string)>();
            if (prices != null) rows.Add((Loc.T("item.condition"), Prices.ConditionName(prices.ConditionOf(it.@float))));
            rows.Add(("Float", it.@float.ToString("0.0000", System.Globalization.CultureInfo.InvariantCulture)));
            rows.AddRange(extra);
            if (it.locked) rows.Add((Loc.T("item.lock"), Loc.T("item.locked")));
            return new PopupView.Card { title = FishingController.ItemName(it.defId), sub = TierName(it.tier), subColour = TierColour(it.tier), rows = rows.ToArray(), note = note };
        }

        /// <summary>Tooltip card of a stack: name, count (and any extra rows), note.</summary>
        public static PopupView.Card Card(ItemStack st, string note = null, params (string, string)[] extra)
        {
            var rows = new System.Collections.Generic.List<(string, string)> { (Loc.T("common.count"), Kit.Num(st.count)) };
            rows.AddRange(extra);
            return new PopupView.Card { title = FishingController.ItemName(st.defId), rows = rows.ToArray(), note = note };
        }

        /// <summary>"Sazan · rare" (plus condition when the catalog is loaded).</summary>
        public static string Short(ItemInstance it, Prices prices)
        {
            var cond = prices != null ? $" · {Prices.ConditionName(prices.ConditionOf(it.@float))}" : "";
            return $"{FishingController.ItemName(it.defId)} · {it.tier}{cond}";
        }

        /// <summary>Short plus the Float value, for windows where the buyer decides on it.</summary>
        public static string Long(ItemInstance it, Prices prices) => $"{Short(it, prices)} · Float {it.@float:0.0000}";

        /// <summary>A stall / board entry: "Sazan (rare)" or "Yem x20".</summary>
        public static string Entry(StallEntry e) =>
            string.IsNullOrEmpty(e.tier) ? $"{FishingController.ItemName(e.defId)} x{e.count}" : $"{FishingController.ItemName(e.defId)} ({e.tier})";
    }
}
