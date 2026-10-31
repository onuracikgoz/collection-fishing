using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>One whisper message: the nick on top, the text under it; mine sit on the right. Made by UiPrefabBuilder.</summary>
    public sealed class WhisperLine : MonoBehaviour
    {
        public Text nick, text;

        public void Set(string nickText, string body, bool mine, Color nickColour, Color bodyColour)
        {
            nick.gameObject.SetActive(!string.IsNullOrEmpty(nickText));
            nick.text = nickText ?? "";
            nick.color = nickColour;
            text.text = body ?? "";
            text.color = bodyColour;
            var align = mine ? TextAnchor.UpperRight : TextAnchor.UpperLeft;
            nick.alignment = text.alignment = align;
        }
    }
}
