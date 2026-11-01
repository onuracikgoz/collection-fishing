using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace CollectionGame
{
    /// <summary>
    /// Small JSON reader for the locale files and get_locale (JsonUtility cannot read a
    /// key → text object). Objects become Dictionary&lt;string, object&gt;, arrays List&lt;object&gt;,
    /// numbers double, plus string, bool and null.
    /// </summary>
    public static class LocJson
    {
        public static object Parse(string json)
        {
            var i = 0;
            var v = Value(json, ref i);
            Space(json, ref i);
            if (i < json.Length) throw new FormatException($"JSON: extra text at {i}");
            return v;
        }

        /// <summary>A flat object's string values (other values are skipped).</summary>
        public static Dictionary<string, string> Strings(object o)
        {
            var d = new Dictionary<string, string>();
            if (o is Dictionary<string, object> obj)
                foreach (var p in obj)
                    if (p.Value is string s) d[p.Key] = s;
            return d;
        }

        /// <summary>Writes a flat key → text object, one key per line, in the given order.</summary>
        public static string Write(IEnumerable<KeyValuePair<string, string>> pairs)
        {
            var sb = new StringBuilder("{\n");
            var first = true;
            foreach (var p in pairs)
            {
                if (!first) sb.Append(",\n");
                first = false;
                sb.Append("  ").Append(Quote(p.Key)).Append(": ").Append(Quote(p.Value ?? ""));
            }
            return sb.Append("\n}\n").ToString();
        }

        public static string Quote(string s)
        {
            var sb = new StringBuilder("\"");
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            return sb.Append('"').ToString();
        }

        static void Space(string s, ref int i)
        {
            while (i < s.Length && char.IsWhiteSpace(s[i])) i++;
        }

        static object Value(string s, ref int i)
        {
            Space(s, ref i);
            if (i >= s.Length) throw new FormatException("JSON: unexpected end");
            var c = s[i];
            if (c == '{') return Obj(s, ref i);
            if (c == '[') return Arr(s, ref i);
            if (c == '"') return Str(s, ref i);
            if (Word(s, ref i, "true")) return true;
            if (Word(s, ref i, "false")) return false;
            if (Word(s, ref i, "null")) return null;
            return Num(s, ref i);
        }

        static bool Word(string s, ref int i, string w)
        {
            if (string.CompareOrdinal(s, i, w, 0, w.Length) != 0) return false;
            i += w.Length;
            return true;
        }

        static Dictionary<string, object> Obj(string s, ref int i)
        {
            var d = new Dictionary<string, object>();
            i++; // {
            Space(s, ref i);
            if (i < s.Length && s[i] == '}')
            {
                i++;
                return d;
            }
            while (true)
            {
                Space(s, ref i);
                if (i >= s.Length || s[i] != '"') throw new FormatException($"JSON: key expected at {i}");
                var key = Str(s, ref i);
                Space(s, ref i);
                if (i >= s.Length || s[i] != ':') throw new FormatException($"JSON: ':' expected at {i}");
                i++;
                d[key] = Value(s, ref i);
                Space(s, ref i);
                if (i < s.Length && s[i] == ',')
                {
                    i++;
                    continue;
                }
                if (i < s.Length && s[i] == '}')
                {
                    i++;
                    return d;
                }
                throw new FormatException($"JSON: ',' or '}}' expected at {i}");
            }
        }

        static List<object> Arr(string s, ref int i)
        {
            var l = new List<object>();
            i++; // [
            Space(s, ref i);
            if (i < s.Length && s[i] == ']')
            {
                i++;
                return l;
            }
            while (true)
            {
                l.Add(Value(s, ref i));
                Space(s, ref i);
                if (i < s.Length && s[i] == ',')
                {
                    i++;
                    continue;
                }
                if (i < s.Length && s[i] == ']')
                {
                    i++;
                    return l;
                }
                throw new FormatException($"JSON: ',' or ']' expected at {i}");
            }
        }

        static string Str(string s, ref int i)
        {
            var sb = new StringBuilder();
            i++; // "
            while (i < s.Length)
            {
                var c = s[i++];
                if (c == '"') return sb.ToString();
                if (c != '\\')
                {
                    sb.Append(c);
                    continue;
                }
                if (i >= s.Length) break;
                var e = s[i++];
                switch (e)
                {
                    case 'n': sb.Append('\n'); break;
                    case 'r': sb.Append('\r'); break;
                    case 't': sb.Append('\t'); break;
                    case 'b': sb.Append('\b'); break;
                    case 'f': sb.Append('\f'); break;
                    case 'u':
                        if (i + 4 > s.Length) throw new FormatException("JSON: bad \\u escape");
                        sb.Append((char)int.Parse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                        i += 4;
                        break;
                    default: sb.Append(e); break; // \" \\ \/
                }
            }
            throw new FormatException("JSON: unterminated string");
        }

        static double Num(string s, ref int i)
        {
            var start = i;
            while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
            if (i == start) throw new FormatException($"JSON: unexpected '{s[i]}' at {i}");
            return double.Parse(s.Substring(start, i - start), NumberStyles.Float, CultureInfo.InvariantCulture);
        }
    }
}
