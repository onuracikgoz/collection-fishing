using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// One chat bubble over a character (kit bubble, rounded): text inside, and on the newest bubble
    /// of a stack the tail that points down at the speaker. World/ChatBubbles places them. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class BubbleView : MonoBehaviour
    {
        public RectTransform rect;
        public Text text;
        public GameObject tail;
        public CanvasGroup fade;

        /// <summary>Widest bubble before the text wraps, layout units.</summary>
        public float maxWidth = 220f;
        public Vector2 padding = new Vector2(10f, 7f);

        /// <summary>Sets the text and sizes the bubble around it (wrapping at <see cref="maxWidth"/>).</summary>
        public void Set(string s)
        {
            text.text = s ?? "";
            var inner = Mathf.Min(maxWidth - padding.x * 2f, Mathf.Ceil(text.preferredWidth) + 2f);
            var settings = text.GetGenerationSettings(new Vector2(inner, 0f));
            var height = Mathf.Ceil(text.cachedTextGeneratorForLayout.GetPreferredHeight(text.text, settings) / Mathf.Max(0.01f, text.pixelsPerUnit));
            rect.sizeDelta = new Vector2(Mathf.Round(inner + padding.x * 2f), Mathf.Round(height + padding.y * 2f));
        }
    }
}
