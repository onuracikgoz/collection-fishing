using CollectionGame.Economy;
using CollectionGame.Fishing;
using CollectionGame.Net;

namespace CollectionGame.UI
{
    /// <summary>One-line item descriptions shared by the trade, stall and board windows.</summary>
    public static class ItemText
    {
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
