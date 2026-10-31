using System.Collections.Generic;
using UnityEngine;

namespace CollectionGame.UI
{
    /// <summary>
    /// Placeholder item icons (31.10.2026, Onur: slots show a picture, never the item name) until the
    /// real icons come (docs/araclar/ui-ikon-promptlari.md). A 16x16 pixel drawing per kind of thing
    /// (fish, boot, bottle, crystal...), the colour picked from the id so one item always looks the same.
    /// Also used for quest, chest and emote slots (<see cref="For"/> takes any key).
    /// </summary>
    public static class ItemIcons
    {
        const int Size = 16;
        static readonly Dictionary<string, Sprite> cache = new Dictionary<string, Sprite>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics() => cache.Clear();

        // o outline, f face, d shade, h light, k dark detail, w white
        static readonly Dictionary<string, string[]> Masks = new Dictionary<string, string[]>
        {
            ["fish"] = new[]
            {
                "................",
                "................",
                "................",
                "......oooo......",
                "....oohhhfoo....",
                "o..ohhffffffo...",
                "oooffffffffkfo..",
                "offfffffffffffo.",
                "oddfffffffffffo.",
                "ooodffffffffoo..",
                "o..oddddddfo....",
                "....oooooooo....",
                "................",
                "................",
                "................",
                "................",
            },
            ["crab"] = new[]
            {
                "................",
                "..oo........oo..",
                ".ohfo......ohfo.",
                ".offo......offo.",
                "..oo..oooo..oo..",
                "...o.ohhffo.o...",
                "...ooffffffoo...",
                "..ofkffffffkfo..",
                "..offffffffffo..",
                ".o.odffffffdo.o.",
                "o..o.oddddo.o..o",
                "...o..oooo..o...",
                "................",
                "................",
                "................",
                "................",
            },
            ["boot"] = new[]
            {
                "................",
                "................",
                ".....oooooo.....",
                ".....ohfffo.....",
                ".....offffo.....",
                ".....offffo.....",
                ".....offffo.....",
                ".....offffo.....",
                ".....offffoo....",
                ".....offfffooo..",
                "....offffffffo..",
                "....offffffffo..",
                "....odddddddddo.",
                "....ooooooooooo.",
                "................",
                "................",
            },
            ["can"] = new[]
            {
                "................",
                "................",
                "................",
                ".....oooooo.....",
                "....ohhhhhho....",
                "....offkkffo....",
                "....offffffo....",
                "....owwwwwwo....",
                "....owkkkkwo....",
                "....owwwwwwo....",
                "....offffffo....",
                "....odddddddo...",
                "....oooooooo....",
                "................",
                "................",
                "................",
            },
            ["shell"] = new[]
            {
                "................",
                "................",
                "................",
                "................",
                "......oooo......",
                "....oohfhfoo....",
                "...ohfhfhfhfo...",
                "..ofhfhfhfhfho..",
                "..ofhfhfhfhfho..",
                "..odfdfdfdfdfo..",
                "...ooddddddoo...",
                ".....oooooo.....",
                "................",
                "................",
                "................",
                "................",
            },
            ["stone"] = new[]
            {
                "................",
                "................",
                "................",
                "................",
                "......ooooo.....",
                "....oohhhffo....",
                "...ohhffffffo...",
                "..ohffffffffdo..",
                "..offffffffddo..",
                "..offfffffdddo..",
                "...odddddddoo...",
                "....ooooooo.....",
                "................",
                "................",
                "................",
                "................",
            },
            ["crystal"] = new[]
            {
                "................",
                ".......oo.......",
                "......ohfo......",
                ".....ohhffo.....",
                "....ohhfffdo....",
                "....ohffffdo....",
                "...ohhffffddo...",
                "...ohffffffdo...",
                "...ohffffffdo...",
                "....ohffffdo....",
                "....ohfffddo....",
                ".....offfdo.....",
                "......ofdo......",
                ".......oo.......",
                "................",
                "................",
            },
            ["glasses"] = new[]
            {
                "................",
                "................",
                "................",
                "................",
                "................",
                "o..............o",
                "o..............o",
                ".oooooo..oooooo.",
                ".ohwffo..ohwffo.",
                ".offffooooffffo.",
                ".offffo..offffo.",
                "..oooo....oooo..",
                "................",
                "................",
                "................",
                "................",
            },
            ["bottle"] = new[]
            {
                "................",
                "......oooo......",
                "......okko......",
                "......offo......",
                "......offo......",
                ".....offffo.....",
                "....ohffffdo....",
                "....ohwwwwdo....",
                "....ohwkkwdo....",
                "....ohwwwwdo....",
                "....ohffffdo....",
                "....ohffffdo....",
                "....oddddddoo...",
                ".....oooooo.....",
                "................",
                "................",
            },
            ["coin"] = new[]
            {
                "................",
                "................",
                "................",
                ".....oooooo.....",
                "....ohhhhffo....",
                "...ohhkkkkffo...",
                "...ohkffffkfo...",
                "...ohkfkkfkfo...",
                "...ohkfkkfkfo...",
                "...ohkffffkfo...",
                "...offkkkkfdo...",
                "....offffddo....",
                ".....oooooo.....",
                "................",
                "................",
                "................",
            },
            ["plant"] = new[]
            {
                "................",
                "................",
                "......o..o......",
                ".....ofo.ofo....",
                "..o..ofoohfo....",
                ".ofo.ohfofo..o..",
                ".ohfo.ofofo.ofo.",
                "..ofoofofooohfo.",
                "...ofofffofffo..",
                "....offfffffo...",
                "....offdddffo...",
                "...oddddddddo...",
                "....oooooooo....",
                "................",
                "................",
                "................",
            },
            ["scale"] = new[]
            {
                "................",
                "................",
                "......oooo......",
                ".....ohhffo.....",
                "....ohhffffo....",
                "...ohhffffffo...",
                "...ohffffffdo...",
                "...offffffddo...",
                "...offfffdddo...",
                "....offfdddo....",
                ".....oddddo.....",
                "......oooo......",
                "................",
                "................",
                "................",
                "................",
            },
            ["worm"] = new[]
            {
                "................",
                "................",
                "................",
                "..........ooo...",
                ".........ohhfo..",
                ".........offko..",
                "...ooo...offo...",
                "..ohhfo..offo...",
                ".ohffffooofffo..",
                ".offooffffffo...",
                ".ofo..offffo....",
                ".odo...oooo.....",
                "..o.............",
                "................",
                "................",
                "................",
            },
            ["scroll"] = new[]
            {
                "................",
                "................",
                "...oooooooooo...",
                "..ohhhhhhhhhfo..",
                "...offffffffo...",
                "...okkkkkkfffo..",
                "...offffffffo...",
                "...okkkkkffffo..",
                "...offffffffo...",
                "...okkkkkkkffo..",
                "...offffffffo...",
                "..ohhhhhhhhhfo..",
                "...oooooooooo...",
                "................",
                "................",
                "................",
            },
            ["star"] = new[]
            {
                "................",
                ".......oo.......",
                "......ohfo......",
                "......ohfo......",
                ".....ohhffo.....",
                "ooooohhfffooooo.",
                "ohhhhhffffffffo.",
                ".ohhffffffffdo..",
                "..offffffffdo...",
                "...offffffdo....",
                "..offfdodffdo...",
                "..offdo.odffo...",
                ".offdo...odffo..",
                ".oooo.....oooo..",
                "................",
                "................",
            },
            ["chest"] = new[]
            {
                "................",
                "................",
                "................",
                "...oooooooooo...",
                "..ohhhhhhhhhfo..",
                "..offffffffffo..",
                "..odddddddddddo.",
                "..oooooookoooo..",
                "..offfffkwkffo..",
                "..offffffkfffo..",
                "..offffffffffo..",
                "..oddddddddddo..",
                "..oooooooooooo..",
                "................",
                "................",
                "................",
            },
            ["face"] = new[]
            {
                "................",
                "................",
                ".....oooooo.....",
                "...oohhhhffoo...",
                "..ohhffffffffo..",
                "..ohfkfffkfffo..",
                ".ohffkfffkffffo.",
                ".offffffffffffo.",
                ".offkffffffkffo.",
                "..offkkkkkkffo..",
                "..odffffffffdo..",
                "...ooddddddoo...",
                ".....oooooo.....",
                "................",
                "................",
                "................",
            },
            ["trash"] = new[]
            {
                "................",
                "......oooo......",
                "..oooooooooooo..",
                "..ohhhhhhhhhfo..",
                "..oooooooooooo..",
                "...offfffffffo..",
                "...ofkfkfkfkfo..",
                "...ofkfkfkfkfo..",
                "...ofkfkfkfkfo..",
                "...ofkfkfkfkfo..",
                "...ofkfkfkfkfo..",
                "...ofkfkfkfkfo..",
                "...odddddddddo..",
                "....oooooooooo..",
                "................",
                "................",
            },
            ["market"] = new[]
            {
                "................",
                ".oooooooooooooo.",
                ".ohfhfhfhfhfhfo.",
                ".ofhfhfhfhfhfho.",
                ".oddddddddddddo.",
                ".oooooooooooooo.",
                "..ok........ko..",
                "..ok........ko..",
                "..ok........ko..",
                ".oooooooooooooo.",
                ".ohhhhhhhhhhhfo.",
                ".offffffffffffo.",
                ".odddddddddddddo",
                ".oooooooooooooo.",
                "..ok........ko..",
                "..oo........oo..",
            },
            ["friends"] = new[]
            {
                "................",
                "................",
                "...oooo..oooo...",
                "..ohhffoohhffo..",
                "..ohfffoohfffo..",
                "..offffooffffo..",
                "...oooo..oooo...",
                "................",
                "..oooooooooooo..",
                ".ohhffffoohhffo.",
                ".ohfffffoohfffo.",
                ".offffffooffffo.",
                ".offffffooffffo.",
                ".oooooooooooooo.",
                "................",
                "................",
            },
            ["person"] = new[]
            {
                "................",
                "......oooo......",
                ".....ohhffo.....",
                ".....ohfffo.....",
                ".....offffo.....",
                ".....offffo.....",
                "......oooo......",
                "................",
                "....oooooooo....",
                "...ohhffffffo...",
                "...ohfffffffo...",
                "...offffffffo...",
                "...offffffffo...",
                "...oooooooooo...",
                "................",
                "................",
            },
            ["book"] = new[]
            {
                "................",
                "..oooooooooooo..",
                "..ofhhhhhhhhfo..",
                "..ofhffffffhfo..",
                "..ofhwwwwwwhfo..",
                "..ofhffffffhfo..",
                "..ofhwwwwwfhfo..",
                "..ofhffffffhfo..",
                "..ofhffffffhfo..",
                "..ofhffffffhfo..",
                "..ofhffffffhfo..",
                "..odddddddddfo..",
                "..owwwwwwwwwdo..",
                "..oooooooooooo..",
                "................",
                "................",
            },
            ["bag"] = new[]
            {
                "................",
                "......oooo......",
                ".....oo..oo.....",
                ".....o....o.....",
                "...oooooooooo...",
                "..ohhhhhhhhhfo..",
                "..ohffffffffdo..",
                "..ooooookoooooo.",
                "..ohffffkfffdo..",
                "..ohffffffffdo..",
                "..ohffffffffdo..",
                "..offffffffddo..",
                "..oddddddddddo..",
                "..oooooooooooo..",
                "................",
                "................",
            },
            ["gear"] = new[]
            {
                "................",
                "......oooo......",
                "...oo.ohfo.oo...",
                "..ohfoohffoofo..",
                "..offhffffffdo..",
                "...offfoooffo...",
                ".oohffo...offoo.",
                ".ohfffo...offdo.",
                ".offffo...offdo.",
                ".oodffo...ofdoo.",
                "...offfoooffo...",
                "..offffffffddo..",
                "..ofdoodddoodo..",
                "...oo.oddo.oo...",
                "......oooo......",
                "................",
            },
            ["enter"] = new[]
            {
                "................",
                "................",
                "...........oo...",
                "..........ohfo..",
                "..........offo..",
                "..........offo..",
                "....oo....offo..",
                "...ohfo...offo..",
                "..ohffooooofffo.",
                ".ohffffffffffdo.",
                "..offdddddddddo.",
                "...odfo.oooooo..",
                "....oo..........",
                "................",
                "................",
                "................",
            },
            ["grip"] = new[]
            {
                "................",
                "................",
                "................",
                "................",
                "..f.f.f.f.f.f...",
                ".f.f.f.f.f.f.f..",
                "................",
                "..f.f.f.f.f.f...",
                ".f.f.f.f.f.f.f..",
                "................",
                "..f.f.f.f.f.f...",
                ".f.f.f.f.f.f.f..",
                "................",
                "................",
                "................",
                "................",
            },
        };

        static readonly string[] FishColours = { "4d9be6", "1ebc73", "f79617", "e6904e", "a884f3", "9babb2", "cd683d", "0eaf9b" };

        /// <summary>The drawing for an item id (lake.fish.pike, bait.shiny...) or a quest / emote key.</summary>
        public static Sprite For(string key)
        {
            key ??= "";
            if (cache.TryGetValue(key, out var s) && s != null) return s;
            var (kind, colour) = Look(key);
            s = Draw(Masks.TryGetValue(kind, out var mask) ? mask : Masks["star"], Hex(colour));
            s.name = "icon " + key;
            cache[key] = s;
            return s;
        }

        static (string kind, string colour) Look(string id)
        {
            switch (id) // HUD buttons (ui.*)
            {
                case "ui.emote": return ("face", "f9c22b");
                case "ui.market": return ("market", "e6904e");
                case "ui.friends": return ("friends", "1ebc73");
                case "ui.profile": return ("person", "8fd3ff");
                case "ui.book": return ("book", "cd683d");
                case "ui.bag": return ("bag", "cd683d");
                case "ui.settings": return ("gear", "9babb2");
                case "ui.send": return ("enter", "f2e8d0");
                case "ui.grip": return ("grip", "f2e8d0");
                case "trash": return ("trash", "9babb2");
            }
            if (id.StartsWith("bait.")) return ("worm", "f68181");
            if (id.StartsWith("recipe.")) return ("scroll", "fdcbb0");
            if (id.StartsWith("craft.")) return ("star", "f9c22b");
            if (id.Contains("crayfish")) return ("crab", "e83b3b");
            if (id.Contains(".fish.")) return ("fish", id.Contains("golden") ? "f9c22b" : FishColours[Hash(id) % FishColours.Length]);
            if (id.Contains("boot")) return ("boot", "9e4539");
            if (id.Contains(".can")) return ("can", "9babb2");
            if (id.Contains("shell")) return ("shell", "fca790");
            if (id.Contains("stone")) return ("stone", "7f708a");
            if (id.Contains("crystal")) return ("crystal", "8fd3ff");
            if (id.Contains("glasses")) return ("glasses", "8fd3ff");
            if (id.Contains("bottle")) return ("bottle", "1ebc73");
            if (id.Contains("coin")) return ("coin", "f9c22b");
            if (id.Contains("moss")) return ("plant", "5ac54f");
            if (id.Contains("scale")) return ("scale", "0eaf9b");
            switch (id) // quest events, the quest chest, emotes
            {
                case "catch": case "deep_water": return ("fish", "4d9be6");
                case "catch_tier": return ("star", "a884f3");
                case "sell": case "trade": return ("coin", "f9c22b");
                case "craft": return ("star", "f9c22b");
                case "merge": return ("crystal", "a884f3");
                case "chest": return ("chest", "cd683d");
                case "emote": return ("face", "f9c22b");
            }
            return ("face", FishColours[Hash(id) % FishColours.Length]);
        }

        static Sprite Draw(string[] mask, Color face)
        {
            var light = Color.Lerp(face, Color.white, 0.45f);
            var shade = Color.Lerp(face, Color.black, 0.35f);
            Color ink = new Color32(0x2e, 0x22, 0x2f, 0xff);
            var tex = new Texture2D(Size, Size, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
            var px = new Color[Size * Size];
            for (var y = 0; y < Size; y++)
            for (var x = 0; x < Size; x++)
            {
                Color c;
                switch (mask[y][x])
                {
                    case 'o': case 'k': c = ink; break;
                    case 'f': c = face; break;
                    case 'd': c = shade; break;
                    case 'h': c = light; break;
                    case 'w': c = Color.white; break;
                    default: c = Color.clear; break;
                }
                px[(Size - 1 - y) * Size + x] = c;
            }
            tex.SetPixels(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, Size, Size), new Vector2(0.5f, 0.5f), Size);
        }

        static int Hash(string s)
        {
            unchecked
            {
                var h = 2166136261u;
                foreach (var c in s) h = (h ^ c) * 16777619u;
                return (int)(h % 1000003u);
            }
        }

        static Color Hex(string h) => ColorUtility.TryParseHtmlString("#" + h, out var c) ? c : Color.magenta;
    }
}
