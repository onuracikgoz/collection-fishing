using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>Zanaatkar of drafts npc-craft / npc-birlestir. Made by UiPrefabBuilder.</summary>
    public sealed class CrafterView : MonoBehaviour
    {
        [System.Serializable]
        public sealed class RecipeCard
        {
            public GameObject root;
            public Image back;
            public Text name, grade;
            public Button button;
        }

        [System.Serializable]
        public sealed class Need
        {
            public GameObject root;
            public SlotView icon;
            public Text name, have;
            public Button pick;
        }

        public WindowView window;
        public TabButton[] tabs;
        public Sprite cardOn, cardOff;
        public Text dust;

        [Header("Craft")]
        public GameObject craft;
        public RecipeCard[] recipes;
        public Text noRecipe;
        public GameObject detail;
        public Text recipeName, recipeSub, recipeDust, quality, note, missing;
        public RectTransform qualityFill;
        public Need[] needs;
        public Button craftButton;
        public Text craftText;

        [Header("Birleştir")]
        public GameObject merge;
        public SlotView[] inputs;
        public Text[] inputNames, inputFloats;
        public SlotView result;
        public Text resultName, mergeDust, mergeQuality, mergeNote;
        public RectTransform mergeFill;
        public Button mergeButton;
        public SlotGrid bag;
        public Sprite barGood, barMid;
    }
}
