using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI
{
    /// <summary>
    /// THE text of the game: every uGUI text is this (UiPrefabBuilder makes nothing else).
    /// Font, sharpness and shadow come from one place (<see cref="GameFont"/> and <see cref="UiStyle"/>);
    /// a text only chooses its <see cref="Size"/> and colour.
    ///
    /// Sharp pixel font: the size is snapped to the font's pixel grid (UiStyle.pixelGrid, 8 for
    /// Press Start 2P: below 18 draws at 8, 18-29 at 16, 30-41 at 24), and bold / italic
    /// (Unity fakes them by smearing the glyphs) are off. Light text gets the style's shadow,
    /// one font pixel down and right, drawn in the same mesh (no Shadow component).
    /// </summary>
    [AddComponentMenu("UI/Game Text")]
    public sealed class GameText : Text
    {
        [SerializeField, Tooltip("Tasarım boyutu (düzen birimi). Ekranda pixel ızgarasına yuvarlanır.")]
        int size = 14;

        [SerializeField, Tooltip("Koyu yazıya da gölge ver (harita üstündeki yazılar gibi).")]
        bool forceShadow;

        static readonly List<UIVertex> verts = new List<UIVertex>();
        static readonly List<UIVertex> withShadow = new List<UIVertex>();

        /// <summary>Design size in layout units; what is drawn is snapped to the pixel grid.</summary>
        public int Size
        {
            get => size;
            set
            {
                if (size == value) return;
                size = value;
                Apply();
            }
        }

        public bool ForceShadow
        {
            get => forceShadow;
            set
            {
                forceShadow = value;
                SetVerticesDirty();
            }
        }

        public override string text
        {
            get => base.text;
            set => base.text = Clean(value);
        }

        protected override void OnEnable()
        {
            base.OnEnable();
            Apply();
        }

        protected override void OnDisable()
        {
            base.OnDisable();
        }

        protected override void OnCanvasHierarchyChanged()
        {
            base.OnCanvasHierarchyChanged();
            Apply();
        }

#if UNITY_EDITOR
        protected override void OnValidate()
        {
            base.OnValidate();
            Apply();
        }
#endif

        /// <summary>Takes the font, style and snapped size from the one style.</summary>
        public void Apply()
        {
            var style = UiStyle.Get();
            var f = GameFont.Get();
            if (f != null && font != f) font = f;
            if (!style.allowBoldItalic && fontStyle != FontStyle.Normal) fontStyle = FontStyle.Normal;
            var want = Snap(size, style.pixelGrid);
            if (fontSize != want) fontSize = want;
        }

        /// <summary>
        /// Font size in layout units that is a whole multiple of the pixel grid (the canvas scale is a
        /// whole number of screen pixels per unit on the usual screens, 1080p 1 and Retina 2, so the
        /// font's pixels stay whole and the layout is the same on every screen). The steps are wide
        /// (31.10.2026, Onur: numbers and headings were too big): body text and numbers (below 2.25
        /// grids, 18 for Press Start 2P) draw at one grid, window titles and big values (18-29) at two,
        /// every 1.5 grids more one step up.
        /// </summary>
        public static int Snap(int size, int grid)
        {
            if (grid <= 0) return size;
            var first = grid * 2.25f;
            if (size < first) return grid;
            return grid * (2 + Mathf.FloorToInt((size - first) / (grid * 1.5f)));
        }

        /// <summary>Drops &lt;b&gt; and &lt;i&gt; tags when the style has bold / italic off.</summary>
        static string Clean(string s)
        {
            if (string.IsNullOrEmpty(s) || s.IndexOf('<') < 0 || UiStyle.Get().allowBoldItalic) return s;
            return s.Replace("<b>", "").Replace("</b>", "").Replace("<i>", "").Replace("</i>", "");
        }

        /// <summary>Light text on a dark box: the style's shadow.</summary>
        bool WantsShadow()
        {
            if (forceShadow) return true;
            var style = UiStyle.Get();
            if (!style.shadowOnLightText) return false;
            var col = color;
            return 0.299f * col.r + 0.587f * col.g + 0.114f * col.b > 0.62f;
        }

        protected override void OnPopulateMesh(VertexHelper toFill)
        {
            base.OnPopulateMesh(toFill);
            if (!WantsShadow() || toFill.currentVertCount == 0) return;
            var style = UiStyle.Get();
            // One font pixel in layout units: the font's pixel grid at this size.
            var pixel = style.pixelGrid > 0 ? fontSize / (float)style.pixelGrid : 1f;
            var offset = new Vector3(pixel, -pixel, 0f) * style.shadowPixels;
            verts.Clear();
            toFill.GetUIVertexStream(verts);
            withShadow.Clear();
            Color32 sc = style.shadowColor;
            foreach (var v in verts)
            {
                var s = v;
                s.position += offset;
                var a = (byte)(sc.a * v.color.a / 255);
                s.color = new Color32(sc.r, sc.g, sc.b, a);
                withShadow.Add(s);
            }
            withShadow.AddRange(verts);
            toFill.Clear();
            toFill.AddUIVertexTriangleStream(withShadow);
        }
    }

    public static class TextSize
    {
        /// <summary>Sets a text's size: the design size of a <see cref="GameText"/>, else Text.fontSize.</summary>
        public static void SetSize(this Text t, int size)
        {
            if (t is GameText g) g.Size = size;
            else t.fontSize = size;
        }
    }
}
