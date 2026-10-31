using System.Collections.Generic;
using CollectionGame.Net;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// Where each thing sits in a slot grid (bag, stash) after the player dragged it there
    /// (31.10.2026, Onur). The order is the client's view, not server data (docs/protokol.md, Eşya
    /// atma): it is kept on this device per account and grid. New things take the first free slot.
    /// </summary>
    public sealed class SlotOrder
    {
        static readonly Dictionary<string, SlotOrder> shared = new Dictionary<string, SlotOrder>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => shared.Clear();

        /// <summary>The one order of a grid ("bag", "stash") for this account: the bag window and the bank share "bag".</summary>
        public static SlotOrder For(string userId, string grid)
        {
            var key = grid + "." + userId;
            if (!shared.TryGetValue(key, out var o)) shared[key] = o = new SlotOrder(userId, grid);
            return o;
        }

        readonly string prefKey;
        readonly Dictionary<string, int> places = new Dictionary<string, int>();

        SlotOrder(string userId, string grid)
        {
            prefKey = $"slots.{grid}.{userId}";
            var saved = PlayerPrefs.GetString(prefKey, "");
            foreach (var part in saved.Split('|'))
            {
                var eq = part.LastIndexOf('=');
                if (eq > 0 && int.TryParse(part.Substring(eq + 1), out var i)) places[part.Substring(0, eq)] = i;
            }
        }

        /// <summary>The key a thing keeps its place by: the instance for Float items, the kind for stacks.</summary>
        public static string KeyOf(object entry) =>
            entry is ItemInstance it ? "i:" + it.instanceId : entry is ItemStack st ? "s:" + st.defId : null;

        /// <summary>
        /// The things laid out in slotCount slots: each at its kept place when that is free, the rest in
        /// the first free slots in the given order. Null for an empty slot.
        /// </summary>
        public object[] Lay(IList<object> entries, int slotCount)
        {
            var grid = new object[Mathf.Max(slotCount, entries.Count)];
            var left = new List<object>();
            foreach (var e in entries)
            {
                var key = KeyOf(e);
                if (key != null && places.TryGetValue(key, out var i) && i >= 0 && i < grid.Length && grid[i] == null) grid[i] = e;
                else left.Add(e);
            }
            var next = 0;
            foreach (var e in left)
            {
                while (next < grid.Length && grid[next] != null) next++;
                if (next >= grid.Length) break;
                grid[next] = e;
            }
            // Remember every place, so a thing does not jump when something before it goes.
            places.Clear();
            for (var i = 0; i < grid.Length; i++)
            {
                var key = KeyOf(grid[i]);
                if (key != null) places[key] = i;
            }
            Save();
            return grid;
        }

        /// <summary>Moves the thing in slot from to slot to; whatever was there takes its old place.</summary>
        public void Swap(object[] grid, int from, int to)
        {
            if (from == to || from < 0 || to < 0 || from >= grid.Length || to >= grid.Length) return;
            (grid[from], grid[to]) = (grid[to], grid[from]);
            var a = KeyOf(grid[from]);
            var b = KeyOf(grid[to]);
            if (a != null) places[a] = from;
            if (b != null) places[b] = to;
            Save();
        }

        void Save()
        {
            var parts = new List<string>();
            foreach (var kv in places) parts.Add(kv.Key + "=" + kv.Value);
            PlayerPrefs.SetString(prefKey, string.Join("|", parts));
        }
    }
}
