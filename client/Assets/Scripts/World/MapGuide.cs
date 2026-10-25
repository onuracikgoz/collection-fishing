using UnityEngine;

namespace CollectionGame.World
{
    /// <summary>Draws the map border (and a grid every 16 tiles) in the Scene view while editing the map prefab.</summary>
    public class MapGuide : MonoBehaviour
    {
        void OnDrawGizmos()
        {
            Gizmos.color = new Color(1f, 0.9f, 0.2f, 0.9f);
            var w = LakeMap.Width;
            var h = LakeMap.Height;
            Gizmos.DrawLine(new Vector3(0, 0), new Vector3(w, 0));
            Gizmos.DrawLine(new Vector3(w, 0), new Vector3(w, -h));
            Gizmos.DrawLine(new Vector3(w, -h), new Vector3(0, -h));
            Gizmos.DrawLine(new Vector3(0, -h), new Vector3(0, 0));
            Gizmos.color = new Color(1f, 1f, 1f, 0.15f);
            for (var x = 16; x < w; x += 16) Gizmos.DrawLine(new Vector3(x, 0), new Vector3(x, -h));
            for (var y = 16; y < h; y += 16) Gizmos.DrawLine(new Vector3(0, -y), new Vector3(w, -y));
        }
    }
}
