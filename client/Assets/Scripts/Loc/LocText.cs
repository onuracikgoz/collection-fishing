using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI
{
    /// <summary>
    /// A fixed label in a prefab: shows the text of <see cref="key"/> in the chosen language and
    /// changes with it. UiPrefabBuilder adds it to every label it writes from a key (L("...")).
    /// If code has since written its own text into the label (a sample text the controller fills),
    /// LocText leaves it alone: it only replaces the text it wrote itself.
    /// </summary>
    [RequireComponent(typeof(Text))]
    [AddComponentMenu("UI/Loc Text")]
    public sealed class LocText : MonoBehaviour
    {
        [Tooltip("Resources/Locales/*.json içindeki anahtar (ör. settings.language).")]
        public string key;

        [Tooltip("İsteğe bağlı ikinci anahtar: soluk renkte, ana yazının yanına eklenir (Ayarlar'daki işaret kutuları).")]
        public string hintKey;

        [SerializeField, HideInInspector] string applied;

        Text text;

        void OnEnable()
        {
            Loc.Changed += Apply;
            Apply();
        }

        void OnDisable() => Loc.Changed -= Apply;

        /// <summary>The label's text in the chosen language.</summary>
        public static string Compose(string key, string hintKey, System.Func<string, string> t) =>
            string.IsNullOrEmpty(hintKey) ? t(key) : $"{t(key)}  <color=#7f708a>{t(hintKey)}</color>";

        /// <summary>Builder: the key(s) and the text the prefab was written with.</summary>
        public void Init(string key, string hintKey, string written)
        {
            this.key = key;
            this.hintKey = hintKey;
            applied = written;
        }

        public void Apply()
        {
            if (string.IsNullOrEmpty(key)) return;
            if (text == null) text = GetComponent<Text>();
            if (text == null) return;
            if (!string.IsNullOrEmpty(applied) && text.text != applied) return; // code owns this label now
            var s = Compose(key, hintKey, Loc.T);
            if (text.text != s) text.text = s;
            applied = text.text;
        }
    }
}
