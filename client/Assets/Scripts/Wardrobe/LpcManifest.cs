using System;
using System.Collections.Generic;
using UnityEngine;

namespace CollectionGame.Wardrobe
{
    /// <summary>
    /// The Universal LPC sheets of every wardrobe part and the colour ramps
    /// (Resources/Wardrobe/lpc.json, written by tools/wardrobe/import_lpc.py).
    /// A part has layers (z order, one sheet per body and animation) and recolour maps:
    /// source colour → tone index of the item's colour ramp (0 shadow … 5 highlight).
    /// Identity layers are the parts "body", "head_male" / "head_female" and "face".
    /// </summary>
    public static class LpcManifest
    {
        public const string ResourcePath = "Wardrobe/lpc";

        [Serializable] public class Ramp { public string id; public string[] tones; }
        [Serializable] public class SheetSet { public string walk; public string idle; public string sit; }
        [Serializable] public class Layer { public int z; public SheetSet male; public SheetSet female; }
        [Serializable] public class ColorMap { public string[] src; public int[] tone; }
        [Serializable] public class Part { public string id; public Layer[] layers; public ColorMap[] maps; }
        [Serializable] class File { public Ramp[] ramps; public Part[] parts; }

        static Dictionary<string, Part> parts;
        static Dictionary<string, Color32[]> ramps;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics()
        {
            parts = null;
            ramps = null;
        }

        static void Load()
        {
            if (parts != null) return;
            parts = new Dictionary<string, Part>();
            ramps = new Dictionary<string, Color32[]>();
            var text = Resources.Load<TextAsset>(ResourcePath);
            if (text == null)
            {
                Debug.LogError($"[Wardrobe] Missing Resources/{ResourcePath}.json (tools/wardrobe/import_lpc.py)");
                return;
            }
            var file = JsonUtility.FromJson<File>(text.text);
            foreach (var p in file.parts ?? Array.Empty<Part>()) parts[p.id] = p;
            foreach (var r in file.ramps ?? Array.Empty<Ramp>())
            {
                var tones = new Color32[r.tones.Length];
                for (var i = 0; i < tones.Length; i++) tones[i] = Hex(r.tones[i]);
                ramps[r.id] = tones;
            }
        }

        public static Part PartById(string id)
        {
            Load();
            return id != null && parts.TryGetValue(id, out var p) ? p : null;
        }

        /// <summary>The colour's tones, or null for "" and unknown ids (the part keeps its drawn colour).</summary>
        public static Color32[] RampOf(string colorId)
        {
            Load();
            return !string.IsNullOrEmpty(colorId) && ramps.TryGetValue(colorId, out var r) ? r : null;
        }

        /// <summary>The middle tone, for colour swatches.</summary>
        public static Color32 Swatch(string colorId)
        {
            var r = RampOf(colorId);
            return r == null || r.Length == 0 ? new Color32(128, 128, 128, 255) : r[Mathf.Min(r.Length - 1, r.Length * 2 / 3)];
        }

        public static SheetSet Sheets(Layer layer, string body) => body == Net.Bodies.Female ? layer.female : layer.male;

        public static Color32 Hex(string h)
        {
            if (string.IsNullOrEmpty(h) || h.Length < 7) return new Color32(0, 0, 0, 255);
            byte B(int i) => Convert.ToByte(h.Substring(i, 2), 16);
            return new Color32(B(1), B(3), B(5), 255);
        }
    }
}
