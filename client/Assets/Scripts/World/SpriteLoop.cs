using UnityEngine;

namespace CollectionGame.World
{
    /// <summary>
    /// Plays a few sprite frames in a loop on this object's SpriteRenderer (windmill sails, later
    /// flags or water wheels). Cheaper than an Animator: one sprite swap when the frame changes.
    /// </summary>
    [RequireComponent(typeof(SpriteRenderer))]
    public class SpriteLoop : MonoBehaviour
    {
        public Sprite[] frames;
        public float framesPerSecond = 8f;

        SpriteRenderer sr;
        int shown = -1;

        public void Play(Sprite[] newFrames, float fps)
        {
            frames = newFrames;
            framesPerSecond = fps;
            shown = -1;
            Update();
        }

        void Update()
        {
            if (frames == null || frames.Length == 0) return;
            if (sr == null) sr = GetComponent<SpriteRenderer>();
            var i = (int)(Time.time * framesPerSecond) % frames.Length;
            if (i == shown) return;
            shown = i;
            sr.sprite = frames[i];
        }
    }
}
