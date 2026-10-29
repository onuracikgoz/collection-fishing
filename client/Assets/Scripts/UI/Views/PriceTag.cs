using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI.Views
{
    /// <summary>The small dark price box under a stall slot (drafts tezgah-*): coin mark and a number.</summary>
    public sealed class PriceTag : MonoBehaviour
    {
        public Text text;

        public void Set(long price)
        {
            gameObject.SetActive(price > 0);
            text.text = Kit.Num(price);
        }
    }
}
