using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// One whisper conversation, Knight Online style (docs/araclar/ui-uygulama.md, Fısıltı penceresi):
    /// small kit window with minimise and menu buttons on the frame, a log, a text field; the menu
    /// row has Engelle / Raporla and the report reasons. <see cref="strip"/> is the minimised form
    /// at the bottom edge. Made by UiPrefabBuilder.
    /// </summary>
    public sealed class WhisperView : MonoBehaviour
    {
        public WindowView window;
        public Button minimize, menuButton;
        public RectTransform menuRow;
        public Button block, report;
        public RectTransform reasonRow;
        public Button[] reasons;
        public ScrollRect scroll;
        public Text log;
        public InputField input;
        public Button send;
        public Button strip;
        public Text stripText;
        public Image plateImage;
    }
}
