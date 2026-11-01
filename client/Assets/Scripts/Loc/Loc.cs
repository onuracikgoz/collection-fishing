using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using UnityEngine;

namespace CollectionGame
{
    /// <summary>
    /// The game's texts by key (docs/araclar/dil-destegi.md). A text is looked up in this order:
    /// the server's text for the chosen language (get_locale, cached on the device), the bundled
    /// file Resources/Locales/&lt;lang&gt;.json, the bundled English file, the bundled Turkish file,
    /// and last the key itself (so a missing key shows up on screen).
    ///
    /// Placeholders are named: <c>Loc.T("bag.discarded", ("item", name))</c> fills <c>{item}</c>.
    /// Item, set and tier names, Float, Coin and proper names are not keys (they stay as they are).
    /// </summary>
    public static class Loc
    {
        public const string Base = "tr";
        public const string Fallback = "en";
        const string LangKey = "cg_lang";
        const string CacheKey = "cg_loc_";
        const string HashKey = "cg_loc_hash_";

        /// <summary>One row of Resources/Locales/languages.json.</summary>
        public sealed class Language
        {
            public string code, name, english;
            /// <summary>Off: shown greyed out in Ayarlar (not translated yet).</summary>
            public bool enabled;
        }

        static readonly Dictionary<string, Dictionary<string, string>> bundled = new Dictionary<string, Dictionary<string, string>>();
        static Dictionary<string, string> remote = new Dictionary<string, string>();
        static List<Language> languages;
        static string lang;
        static CultureInfo culture;
        static readonly HashSet<string> warned = new HashSet<string>();
        static Net.Connection lastNet;
        static readonly Regex Hole = new Regex(@"\{([A-Za-z0-9_]+)\}");

        /// <summary>Goes up every time the texts change (language picked, server texts arrived).</summary>
        public static int Version { get; private set; }

        /// <summary>The texts changed: static labels (<see cref="UI.LocText"/>) and windows redraw.</summary>
        public static event Action Changed;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics()
        {
            bundled.Clear();
            remote = new Dictionary<string, string>();
            languages = null;
            lang = null;
            culture = null;
            warned.Clear();
            lastNet = null;
            Changed = null;
        }

        /// <summary>The chosen language code (tr, en, ...). First run: the system language if it is selectable, else English.</summary>
        public static string Lang
        {
            get
            {
                if (lang != null) return lang;
                var saved = PlayerPrefs.GetString(LangKey, "");
                lang = IsEnabled(saved) ? saved : (Application.systemLanguage == SystemLanguage.Turkish && IsEnabled(Base) ? Base : Fallback);
                LoadCache(lang);
                return lang;
            }
        }

        /// <summary>Numbers and dates in the chosen language.</summary>
        public static CultureInfo Culture
        {
            get
            {
                if (culture != null) return culture;
                try
                {
                    culture = CultureInfo.GetCultureInfo(Lang);
                }
                catch (Exception)
                {
                    culture = CultureInfo.InvariantCulture;
                }
                return culture;
            }
        }

        public static IReadOnlyList<Language> Languages
        {
            get
            {
                if (languages != null) return languages;
                languages = new List<Language>();
                var asset = Resources.Load<TextAsset>("Locales/languages");
                try
                {
                    if (asset != null && LocJson.Parse(asset.text) is List<object> rows)
                        foreach (var r in rows)
                            if (r is Dictionary<string, object> d && d.TryGetValue("code", out var c) && c is string code)
                                languages.Add(new Language
                                {
                                    code = code,
                                    name = d.TryGetValue("name", out var n) ? n as string ?? code : code,
                                    english = d.TryGetValue("english", out var e) ? e as string ?? code : code,
                                    enabled = d.TryGetValue("enabled", out var on) && on is bool b && b,
                                });
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[Loc] languages.json: {ex.Message}");
                }
                if (languages.Count == 0) languages.Add(new Language { code = Base, name = "Türkçe", english = "Turkish", enabled = true });
                return languages;
            }
        }

        public static bool IsEnabled(string code)
        {
            if (string.IsNullOrEmpty(code)) return false;
            foreach (var l in Languages)
                if (l.code == code) return l.enabled;
            return false;
        }

        public static Language Current
        {
            get
            {
                foreach (var l in Languages)
                    if (l.code == Lang) return l;
                return Languages[0];
            }
        }

        /// <summary>Picks a language (only enabled ones). Texts change at once; server texts come with the next fetch.</summary>
        public static void SetLanguage(string code)
        {
            if (!IsEnabled(code) || code == Lang) return;
            lang = code;
            culture = null;
            PlayerPrefs.SetString(LangKey, code);
            PlayerPrefs.Save();
            remote = new Dictionary<string, string>();
            LoadCache(code);
            Bump();
            if (lastNet != null) _ = FetchAsync(lastNet); // server fixes for the new language
        }

        // ---------- lookup ----------

        public static string T(string key)
        {
            if (string.IsNullOrEmpty(key)) return "";
            if (remote.TryGetValue(key, out var s) && !string.IsNullOrEmpty(s)) return s;
            if (Find(Lang, key, out s)) return s;
            if (Find(Fallback, key, out s)) return s;
            if (Find(Base, key, out s)) return s;
            if (warned.Add(key)) Debug.LogWarning($"[Loc] missing key: {key}");
            return key;
        }

        /// <summary>Text with named placeholders: T("bag.discarded", ("item", name)) fills {item}.</summary>
        public static string T(string key, params (string name, object value)[] args)
        {
            var s = T(key);
            if (args == null || args.Length == 0 || s.IndexOf('{') < 0) return s;
            var sb = new StringBuilder(s);
            foreach (var (name, value) in args)
                sb.Replace("{" + name + "}", Format(value));
            return sb.ToString();
        }

        /// <summary>Marks a key inside a plain string field (prefab tooltips): "@@key".</summary>
        public const string Marker = "@@";

        /// <summary>"@@key" → the key's text; any other string stays as it is.</summary>
        public static string Resolve(string s) =>
            s != null && s.StartsWith(Marker, StringComparison.Ordinal) ? T(s.Substring(Marker.Length)) : s;

        /// <summary>A key's bundled text in one language (UiPrefabBuilder writes prefabs in Turkish).</summary>
        public static string BundledText(string code, string key) =>
            Find(code, key, out var s) || Find(Base, key, out s) ? s : key;

        /// <summary>True when the key has a text in some file (for optional texts).</summary>
        public static bool Has(string key) =>
            remote.ContainsKey(key) || Find(Lang, key, out _) || Find(Fallback, key, out _) || Find(Base, key, out _);

        /// <summary>
        /// A server error code (reason) as text: "&lt;area&gt;.err.&lt;CODE&gt;", else "err.&lt;CODE&gt;",
        /// else "&lt;area&gt;.err.unknown" / "err.unknown" with {code}. The server sends codes only.
        /// </summary>
        public static string Reason(string area, string code)
        {
            if (string.IsNullOrEmpty(code)) code = "UNKNOWN";
            var k = area + ".err." + code;
            if (Has(k)) return T(k);
            k = "err." + code;
            if (Has(k)) return T(k);
            k = area + ".err.unknown";
            return T(Has(k) ? k : "err.unknown", ("code", code));
        }

        static string Format(object v) =>
            v == null ? "" : v is IFormattable f ? f.ToString(null, Culture) : v.ToString();

        static bool Find(string code, string key, out string s)
        {
            s = null;
            var d = Bundled(code);
            return d != null && d.TryGetValue(key, out s) && !string.IsNullOrEmpty(s);
        }

        static Dictionary<string, string> Bundled(string code)
        {
            if (string.IsNullOrEmpty(code)) return null;
            if (bundled.TryGetValue(code, out var d)) return d;
            d = new Dictionary<string, string>();
            var asset = Resources.Load<TextAsset>("Locales/" + code);
            if (asset != null)
            {
                try
                {
                    d = LocJson.Strings(LocJson.Parse(asset.text));
                }
                catch (Exception e)
                {
                    Debug.LogWarning($"[Loc] Locales/{code}.json: {e.Message}");
                }
            }
            bundled[code] = d;
            return d;
        }

        /// <summary>Every key of the Turkish file (tools and checks).</summary>
        public static IEnumerable<string> Keys => Bundled(Base).Keys;

        // ---------- server texts (get_locale, docs/protokol.md Dil dosyaları) ----------

        /// <summary>
        /// Asks the server for the chosen language's texts; sends the cached hash so an unchanged
        /// file is not sent again. Any failure keeps the bundled / cached texts.
        /// </summary>
        public static async Task FetchAsync(Net.Connection net)
        {
            lastNet = net;
            var code = Lang;
            try
            {
                var body = "{\"lang\":" + LocJson.Quote(code) + ",\"hash\":" + LocJson.Quote(PlayerPrefs.GetString(HashKey + code, "")) + "}";
                var json = await net.RpcRawAsync("get_locale", body);
                if (code != Lang || string.IsNullOrEmpty(json)) return;
                if (!(LocJson.Parse(json) is Dictionary<string, object> r)) return;
                if (!r.TryGetValue("strings", out var strings) || !(strings is Dictionary<string, object>)) return; // hash matched
                var hash = r.TryGetValue("hash", out var h) ? h as string ?? "" : "";
                var texts = Checked(LocJson.Strings(strings));
                PlayerPrefs.SetString(CacheKey + code, LocJson.Write(texts));
                PlayerPrefs.SetString(HashKey + code, hash);
                PlayerPrefs.Save();
                remote = texts;
                Bump();
            }
            catch (Exception e)
            {
                // No get_locale on this server yet, or no network: the bundled texts stay.
                Debug.Log($"[Loc] get_locale skipped: {e.Message}");
            }
        }

        static void LoadCache(string code)
        {
            var json = PlayerPrefs.GetString(CacheKey + code, "");
            if (json.Length == 0) return;
            try
            {
                remote = Checked(LocJson.Strings(LocJson.Parse(json)));
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Loc] cache for {code}: {e.Message}");
                remote = new Dictionary<string, string>();
            }
        }

        /// <summary>
        /// Drops server texts whose placeholders differ from the bundled Turkish text (a typo there
        /// would otherwise reach every player at once); the bundled text is used for those.
        /// </summary>
        static Dictionary<string, string> Checked(Dictionary<string, string> texts)
        {
            var reference = Bundled(Base);
            var ok = new Dictionary<string, string>();
            foreach (var p in texts)
            {
                if (string.IsNullOrEmpty(p.Value)) continue;
                if (reference.TryGetValue(p.Key, out var tr) && !SameHoles(tr, p.Value))
                {
                    Debug.LogWarning($"[Loc] server text for {p.Key} has other placeholders; using the bundled one");
                    continue;
                }
                ok[p.Key] = p.Value;
            }
            return ok;
        }

        public static bool SameHoles(string a, string b)
        {
            var x = new HashSet<string>();
            foreach (Match m in Hole.Matches(a)) x.Add(m.Groups[1].Value);
            var y = new HashSet<string>();
            foreach (Match m in Hole.Matches(b)) y.Add(m.Groups[1].Value);
            return x.SetEquals(y);
        }

        static void Bump()
        {
            Version++;
            Changed?.Invoke();
        }
    }
}
