using System.Collections.Generic;
using CollectionGame.Net;
using UnityEngine;

namespace CollectionGame.World
{
    /// <summary>
    /// Smooths another player's movement: positions from PLAYER_ENTER / SNAPSHOT are
    /// stamped with local arrival time and shown <see cref="Delay"/> seconds late,
    /// interpolating between the two samples around that moment. No extrapolation.
    /// </summary>
    public sealed class RemoteMover
    {
        const float Delay = 0.15f;
        /// <summary>A jump longer than this (respawn, correction) is not walked.</summary>
        const float SnapDistance = 3f;
        const float SendGap = 0.1f; // server tick

        struct Sample
        {
            public float t;
            public Vector2 pos;
            public string dir;
            public bool moving;
        }

        readonly List<Sample> samples = new List<Sample>();

        public Vector2 Position { get; private set; }
        public string Facing { get; private set; } = Dir.Down;
        public bool Moving { get; private set; }

        public RemoteMover(PlayerView start, float now) => Reset(start, now);

        public void Reset(PlayerView v, float now)
        {
            samples.Clear();
            samples.Add(ToSample(v, now));
            Position = samples[0].pos;
            Facing = v.dir;
            Moving = v.moving;
        }

        public void Push(PlayerView v, float now)
        {
            var s = ToSample(v, now);
            var last = samples[samples.Count - 1];
            if (Vector2.Distance(last.pos, s.pos) > SnapDistance)
            {
                Reset(v, now);
                return;
            }
            // After standing still the previous sample is old; start the walk from "just now"
            // instead of stretching it over the whole pause.
            if (now - last.t > SendGap)
            {
                last.t = now - SendGap;
                samples.Add(last);
            }
            samples.Add(s);
        }

        public void Update(float now)
        {
            var rt = now - Delay;
            while (samples.Count > 2 && samples[1].t <= rt) samples.RemoveAt(0);

            var a = samples[0];
            if (samples.Count == 1 || rt <= a.t)
            {
                Hold(a, now);
                return;
            }
            var b = samples[1];
            if (rt >= b.t)
            {
                Hold(b, now);
                return;
            }
            var k = (rt - a.t) / Mathf.Max(0.0001f, b.t - a.t);
            Position = Vector2.Lerp(a.pos, b.pos, k);
            Facing = b.dir;
            Moving = a.pos != b.pos || b.moving;
        }

        void Hold(Sample s, float now)
        {
            Position = s.pos;
            Facing = s.dir;
            // No news for a while: stop the walk animation instead of walking in place.
            Moving = s.moving && now - s.t < 0.5f;
        }

        static Sample ToSample(PlayerView v, float now) =>
            new Sample { t = now, pos = new Vector2(v.x, v.y), dir = string.IsNullOrEmpty(v.dir) ? Dir.Down : v.dir, moving = v.moving };
    }
}
