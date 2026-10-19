using CollectionGame.Net;
using CollectionGame.World;
using UnityEngine;

namespace CollectionGame.Fishing
{
    /// <summary>
    /// A bobber on the water and the line back to its fisher. Placeholder art drawn
    /// in code (red and white float). States from BOBBER: cast bobs gently, twitch
    /// dips briefly, bite sinks.
    /// </summary>
    public class BobberView : MonoBehaviour
    {
        const int Px = 8;
        // Rod tip relative to the fisher's feet, in tiles.
        static readonly Vector3 RodTip = new Vector3(0f, 1.1f, 0f);

        SpriteRenderer body;
        SpriteRenderer line;
        Vector2 pos;
        string state = BobberState.Cast;
        float stateAt;

        public static BobberView Create(Transform parent, string id)
        {
            var go = new GameObject($"Bobber {id}");
            go.transform.SetParent(parent, false);
            var view = go.AddComponent<BobberView>();

            view.body = new GameObject("Float").AddComponent<SpriteRenderer>();
            view.body.transform.SetParent(go.transform, false);
            view.body.sprite = FloatSprite();
            view.body.sortingOrder = MapView.OverlayOrder + 2;

            view.line = new GameObject("Line").AddComponent<SpriteRenderer>();
            view.line.transform.SetParent(go.transform, false);
            view.line.sprite = PixelSprite();
            view.line.color = new Color(1f, 1f, 1f, 0.7f);
            view.line.sortingOrder = MapView.OverlayOrder + 1;
            return view;
        }

        public void Set(Vector2 serverPos, string newState)
        {
            pos = serverPos;
            if (newState != state || newState == BobberState.Twitch) stateAt = Time.time;
            state = newState;
        }

        /// <summary>Animates the float and stretches the line to the fisher (null if out of view).</summary>
        public void Tick(Vector2? fisher)
        {
            var t = Time.time - stateAt;
            // Twitch only wiggles sideways (do not pull!); a bite pulls the float under.
            var offset = Vector3.zero;
            if (state == BobberState.Bite) offset.y = -0.22f + 0.03f * Mathf.Sin(Time.time * 25f);
            else if (state == BobberState.Twitch && t < 0.4f) offset.x = 0.06f * Mathf.Sin(t * 60f);
            else offset.y = 0.03f * Mathf.Sin(Time.time * 3f);

            var p = Coords.ToUnity(pos) + offset;
            body.transform.position = p;
            body.color = state == BobberState.Bite ? new Color(1f, 1f, 1f, 0.55f) : Color.white;

            line.enabled = fisher.HasValue;
            if (!fisher.HasValue) return;
            var from = Coords.ToUnity(fisher.Value) + RodTip;
            var d = p - from;
            line.transform.position = from + d / 2f;
            line.transform.rotation = Quaternion.Euler(0f, 0f, Mathf.Atan2(d.y, d.x) * Mathf.Rad2Deg);
            line.transform.localScale = new Vector3(d.magnitude * 32f, 1f, 1f);
        }

        static Sprite floatSprite;
        static Sprite pixelSprite;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetStatics()
        {
            floatSprite = null;
            pixelSprite = null;
        }

        static Sprite FloatSprite()
        {
            if (floatSprite != null) return floatSprite;
            var tex = new Texture2D(Px, Px) { filterMode = FilterMode.Point };
            for (var y = 0; y < Px; y++)
            for (var x = 0; x < Px; x++)
            {
                var dx = x - 3.5f;
                var dy = y - 3.5f;
                var inside = dx * dx + dy * dy <= 10f;
                var c = !inside ? Color.clear : y >= 4 ? new Color(0.9f, 0.15f, 0.15f) : Color.white;
                if (inside && dx * dx + dy * dy > 6.5f) c *= 0.75f; // outline
                c.a = inside ? 1f : 0f;
                tex.SetPixel(x, y, c);
            }
            tex.Apply();
            floatSprite = Sprite.Create(tex, new Rect(0, 0, Px, Px), new Vector2(0.5f, 0.3f), 32f);
            return floatSprite;
        }

        static Sprite PixelSprite()
        {
            if (pixelSprite != null) return pixelSprite;
            var tex = new Texture2D(1, 1) { filterMode = FilterMode.Point };
            tex.SetPixel(0, 0, Color.white);
            tex.Apply();
            pixelSprite = Sprite.Create(tex, new Rect(0, 0, 1, 1), new Vector2(0.5f, 0.5f), 32f);
            return pixelSprite;
        }
    }
}
