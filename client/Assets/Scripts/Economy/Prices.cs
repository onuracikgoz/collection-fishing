using System;
using CollectionGame.Net;

namespace CollectionGame.Economy
{
    /// <summary>
    /// Display-only lookups over the get_catalog answer: price previews, quality
    /// words, repair cost. Mirrors the server rules (rules/economy.ts, craft.ts,
    /// rod.ts) only to show numbers before a click; every result comes from the server.
    /// </summary>
    public sealed class Prices
    {
        public readonly CatalogResponse Catalog;

        public Prices(CatalogResponse catalog) => Catalog = catalog;

        public CatalogTier Tier(string tier)
        {
            if (Catalog.tiers != null)
                foreach (var t in Catalog.tiers)
                    if (t.tier == tier) return t;
            return null;
        }

        public CatalogStack Stack(string defId)
        {
            if (Catalog.stacks != null)
                foreach (var s in Catalog.stacks)
                    if (s.defId == defId) return s;
            return null;
        }

        public CatalogRecipe Recipe(string id)
        {
            if (Catalog.recipes != null)
                foreach (var r in Catalog.recipes)
                    if (r.id == id) return r;
            return null;
        }

        public CatalogBait Bait(string defId)
        {
            if (Catalog.baits != null)
                foreach (var b in Catalog.baits)
                    if (b.defId == defId) return b;
            return null;
        }

        /// <summary>"pristine" ... "damaged" for a Float, like rules/economy.ts conditionOf.</summary>
        public string ConditionOf(float f)
        {
            var bands = Catalog.conditions;
            if (bands == null || bands.Length == 0) return "";
            foreach (var b in bands)
                if (f >= b.min && f < b.max) return b.condition;
            return bands[bands.Length - 1].condition;
        }

        double Multiplier(string condition)
        {
            if (Catalog.conditions != null)
                foreach (var b in Catalog.conditions)
                    if (b.condition == condition) return b.multiplier;
            return 1.0;
        }

        /// <summary>NPC price of a Float item: Tier price x condition, rounded half up (JS Math.round), at least 1.</summary>
        public int SellPrice(ItemInstance item)
        {
            var t = Tier(item.tier);
            if (t == null) return 0;
            return Math.Max(1, (int)Math.Floor(t.sell * Multiplier(ConditionOf(item.@float)) + 0.5));
        }

        public int DustOf(ItemInstance item) => Tier(item.tier)?.dust ?? 0;

        /// <summary>Per unit; 0 = the NPC does not buy it.</summary>
        public int SellPrice(string stackDefId) => Stack(stackDefId)?.sell ?? 0;

        /// <summary>Per unit; 0 = cannot be salvaged.</summary>
        public int DustOf(string stackDefId) => Stack(stackDefId)?.dust ?? 0;

        public int MergeDust(string tier) => Tier(tier)?.merge ?? 0;

        /// <summary>
        /// The craft "Kalite şansı" word from the average input Float (protokol.md:
        /// the client shows a word, never the exact chance). Null = no Float inputs.
        /// </summary>
        public string QualityWord(float? average)
        {
            var steps = Catalog.qualitySteps ?? Array.Empty<float>();
            if (!average.HasValue) return "Normal";
            // Steps are best first: below steps[0] is the best row.
            string[] words = { "Çok Yüksek", "Yüksek", "Normal" };
            for (var i = 0; i < steps.Length && i < words.Length; i++)
                if (average.Value < steps[i]) return words[i];
            return "Düşük";
        }

        /// <summary>Repair cost for the missing points, like rules/rod.ts: ceil(missing x full / max).</summary>
        public int RepairCost(RodView rod)
        {
            if (rod == null || rod.max <= 0) return 0;
            var missing = rod.max - rod.durability;
            if (missing <= 0) return 0;
            var full = 0;
            if (Catalog.rodLevels != null)
                foreach (var l in Catalog.rodLevels)
                    if (l.level == rod.level) full = l.fullRepair;
            if (full == 0 && Catalog.rodLevels != null && Catalog.rodLevels.Length > 0) full = Catalog.rodLevels[0].fullRepair;
            return (int)Math.Ceiling(missing * (double)full / rod.max);
        }

        /// <summary>The next stash tier, or null at the top.</summary>
        public CatalogStashTier NextStashTier(int level)
        {
            var tiers = Catalog.stash?.tiers;
            if (tiers == null || level < 0 || level >= tiers.Length) return null;
            return tiers[level];
        }

        public static string ConditionName(string c)
        {
            switch (c)
            {
                case "pristine": return "Pristine";
                case "excellent": return "Excellent";
                case "normal": return "Normal";
                case "worn": return "Worn";
                case "damaged": return "Damaged";
                default: return c ?? "";
            }
        }

        public static string GradeName(string grade)
        {
            switch (grade)
            {
                case "normal": return "Normal";
                case "good": return "İyi";
                case "master": return "Usta";
                default: return grade ?? "";
            }
        }

        /// <summary>What the recipe grade promises about the result (08-recipe-craft.md).</summary>
        public static string GradeNote(string grade)
        {
            switch (grade)
            {
                case "good": return "Worn / Damaged çıkmaz";
                case "master": return "en az Excellent";
                default: return "";
            }
        }
    }
}
