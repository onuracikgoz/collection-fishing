using System.Collections.Generic;
using CollectionGame.Net;

namespace CollectionGame.Fishing
{
    /// <summary>
    /// mulberry32, bit for bit the same as server/src/rules/rng.ts (uint math
    /// stands in for Math.imul and >>> 0).
    /// </summary>
    public sealed class Mulberry32
    {
        uint a;

        public Mulberry32(uint seed) => a = seed;

        public uint Next()
        {
            unchecked
            {
                a += 0x6d2b79f5u;
                var t = a;
                t = (t ^ (t >> 15)) * (t | 1u);
                t ^= t + (t ^ (t >> 7)) * (t | 61u);
                return t ^ (t >> 14);
            }
        }
    }

    /// <summary>
    /// The reel mini game from docs/protokol.md (Mini oyun modeli), integer only,
    /// ported from server/src/rules/reel.ts. The server replays the same inputs to
    /// decide the result; this copy draws the game and must agree step for step
    /// (checked against server/test/fixtures/reel-reference.json).
    /// </summary>
    public sealed class ReelModel
    {
        public const int Field = 1000;
        public const int StepMs = 20;
        public const int StartProgress = 300;

        readonly ReelParams p;
        readonly Mulberry32 rng;
        int target;
        int retargetLeft;

        public int Bar { get; private set; }
        public int Vel { get; private set; }
        public int Fish { get; private set; }
        public int Progress { get; private set; }
        /// <summary>Steps played so far; step k covers time (k-1)*20 .. k*20 ms.</summary>
        public int Steps { get; private set; }
        public bool Done { get; private set; }
        public bool Caught { get; private set; }
        public ReelParams Params => p;

        public ReelModel(uint seed, ReelParams p)
        {
            this.p = p;
            rng = new Mulberry32(seed);
            Bar = (Field - p.barSize) / 2;
            Fish = Field / 2;
            target = Fish;
            Progress = StartProgress;
        }

        /// <summary>Plays one step with the key held or not.</summary>
        public void Step(bool pressed)
        {
            if (Done) return;
            var k = ++Steps;

            Vel += pressed ? p.lift : -p.gravity;
            if (Vel > p.maxVel) Vel = p.maxVel;
            if (Vel < -p.maxVel) Vel = -p.maxVel;
            Bar += Vel;
            if (Bar < 0)
            {
                Bar = 0;
                Vel = 0;
            }
            if (Bar > Field - p.barSize)
            {
                Bar = Field - p.barSize;
                Vel = 0;
            }

            if (retargetLeft == 0)
            {
                target = (int)(rng.Next() % (Field + 1));
                retargetLeft = p.retargetSteps;
            }
            else
            {
                retargetLeft--;
            }
            Fish = Fish < target ? System.Math.Min(target, Fish + p.fishSpeed) : System.Math.Max(target, Fish - p.fishSpeed);

            if (Fish >= Bar && Fish <= Bar + p.barSize) Progress += p.gain;
            else Progress -= p.loss;

            if (Progress >= Field) Finish(true);
            else if (Progress <= 0) Finish(false);
            else if (k >= p.maxSteps) Finish(false);
        }

        void Finish(bool caught)
        {
            Done = true;
            Caught = caught;
        }

        /// <summary>Replays a REEL_DONE input log exactly like the server does.</summary>
        public static (bool caught, int steps) Simulate(uint seed, ReelParams p, IReadOnlyList<int> inputs)
        {
            var game = new ReelModel(seed, p);
            var pressed = false;
            var next = 0;
            while (!game.Done)
            {
                var now = (game.Steps + 1) * StepMs;
                while (next < inputs.Count && inputs[next] <= now)
                {
                    pressed = !pressed;
                    next++;
                }
                game.Step(pressed);
            }
            return (game.Caught, game.Steps);
        }
    }
}
