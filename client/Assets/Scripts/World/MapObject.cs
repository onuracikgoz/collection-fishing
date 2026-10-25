using UnityEngine;

namespace CollectionGame.World
{
    /// <summary>
    /// For anything dragged into the map prefab that stands in the world: a tree, a house, a sign,
    /// the fountain. Sorts the sprite against the characters by its feet (the bottom edge of the
    /// sprite), so a player walking behind a tree is hidden by it and in front of it is not.
    /// Add it to the object that has the SpriteRenderer. It does not block walking: mark those
    /// tiles in the Blocked tilemap.
    /// </summary>
    [ExecuteAlways]
    [RequireComponent(typeof(SpriteRenderer))]
    public class MapObject : MonoBehaviour
    {
        [Tooltip("Moves the feet line down (+) or up (-), in tiles. For sprites with empty space under the art.")]
        public float feetShift;

        SpriteRenderer sr;

        void OnEnable() => Apply();
        void Start() => Apply();

        void OnValidate() => Apply();

#if UNITY_EDITOR
        void Update()
        {
            if (!Application.isPlaying) Apply(); // follows the sprite while it is moved in the editor
        }
#endif

        public void Apply()
        {
            if (sr == null) sr = GetComponent<SpriteRenderer>();
            if (sr == null || sr.sprite == null) return;
            // Unity y = -server y, so the server y of the feet is minus the bottom of the sprite.
            var feetServerY = -sr.bounds.min.y + feetShift;
            sr.sortingOrder = CharacterView.SortingOrderFor(feetServerY);
        }
    }
}
