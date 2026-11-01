using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI
{
    /// <summary>
    /// Plays the light streak of a Pristine / Excellent copy (<see cref="FloatLook"/>): every period seconds
    /// the pre-painted frames run over <see cref="Sweep"/> seconds, then the still picture shows again.
    /// Added to an item Image at runtime; stopped when the Image shows something else.
    /// </summary>
    public sealed class FloatShine : MonoBehaviour
    {
        public const float Sweep = 0.45f;

        Image img;
        Sprite rest;
        Sprite[] frames;
        float period, phase;

        public void Play(Image image, Sprite still, Sprite[] streak, float every, float offset)
        {
            img = image;
            rest = still;
            frames = streak;
            period = Mathf.Max(Sweep + 0.1f, every);
            phase = offset;
            enabled = true;
        }

        public void Stop()
        {
            frames = null;
            rest = null;
            enabled = false;
        }

        void Update()
        {
            if (img == null || frames == null || frames.Length == 0) return;
            var t = (Time.unscaledTime + phase) % period;
            var s = t < Sweep ? frames[Mathf.Min(frames.Length - 1, (int)(t / Sweep * frames.Length))] : rest;
            if (s != null && img.sprite != s) img.sprite = s;
        }
    }
}
