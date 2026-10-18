using CollectionGame.Net;
using UnityEngine;

namespace CollectionGame.World
{
    /// <summary>
    /// Client-side prediction for our own character (docs/protokol.md, Hareket kuralları):
    /// walk immediately with the same collision as the server, send MOVE at most
    /// 10 times a second with an increasing seq, jump back on CORRECTION.
    /// All positions are server tiles (y grows down).
    /// </summary>
    public sealed class LocalMover
    {
        /// <summary>Server config walkSpeed (Öneri). The server allows ×1.2.</summary>
        public const float WalkSpeed = 4f;
        public const float SendInterval = 0.1f; // 10 Hz
        // Long frames are split so a hitch never looks like a teleport to the server.
        const float MaxStep = 0.1f;
        const float ArriveDistance = 0.05f;

        public Vector2 Position { get; private set; }
        public string Facing { get; private set; } = Dir.Down;
        public bool Moving { get; private set; }
        public Vector2? Target { get; private set; }

        int seq;
        float lastSendAt = float.NegativeInfinity;
        Vector2 sentPos;
        string sentFacing;
        bool sentMoving;
        /// <summary>CORRECTIONs for MOVEs sent before our last snap are stale.</summary>
        int ignoreCorrectionsUpTo;

        public LocalMover(Vector2 start)
        {
            Position = start;
            sentPos = start;
            sentFacing = Facing;
        }

        public void SetTarget(Vector2 target) => Target = target;

        public void ClearTarget() => Target = null;

        /// <summary>
        /// Advances one frame. <paramref name="input"/> is the WASD direction in server
        /// axes (+y = down); it overrides a click target. Returns a MOVE to send, or null.
        /// </summary>
        public MoveMsg Tick(Vector2 input, float dt, float now)
        {
            var moved = false;
            if (input != Vector2.zero) Target = null;

            for (var left = Mathf.Min(dt, 0.25f); left > 0f; left -= MaxStep)
                moved |= Step(input, Mathf.Min(left, MaxStep));
            Moving = moved;

            var changed = Position != sentPos || Moving != sentMoving || Facing != sentFacing;
            if (!changed || now - lastSendAt < SendInterval) return null;

            lastSendAt = now;
            sentPos = Position;
            sentMoving = Moving;
            sentFacing = Facing;
            return new MoveMsg { seq = ++seq, x = Position.x, y = Position.y, dir = Facing, moving = Moving };
        }

        bool Step(Vector2 input, float dt)
        {
            var want = input;
            if (want == Vector2.zero && Target.HasValue)
            {
                want = Target.Value - Position;
                if (want.magnitude <= ArriveDistance)
                {
                    Target = null;
                    return false;
                }
            }
            if (want == Vector2.zero) return false;

            Facing = FacingFor(want);
            var delta = want.normalized * (WalkSpeed * dt);
            if (Target.HasValue && input == Vector2.zero && delta.magnitude > want.magnitude) delta = want;

            // Try the full step, then slide along walls on one axis.
            foreach (var d in new[] { delta, new Vector2(delta.x, 0f), new Vector2(0f, delta.y) })
            {
                if (d == Vector2.zero) continue;
                var next = Position + d;
                // The server checks the straight line from the last MOVE it accepted,
                // so a slide around a corner must not cut through a blocked tile.
                if (LakeMap.IsWalkable(next) && LakeMap.IsPathClear(Position, next) && LakeMap.IsPathClear(sentPos, next))
                {
                    Position = next;
                    return true;
                }
            }

            // Blocked: a click target we cannot reach is dropped, held keys keep pushing.
            if (input == Vector2.zero) Target = null;
            return false;
        }

        /// <summary>Server rejected a MOVE: jump to where it says we are.</summary>
        public bool ApplyCorrection(CorrectionMsg fix)
        {
            if (fix.seq <= ignoreCorrectionsUpTo) return false;
            ignoreCorrectionsUpTo = seq;
            Position = new Vector2(fix.x, fix.y);
            sentPos = Position;
            Target = null;
            Moving = false;
            return true;
        }

        public static string FacingFor(Vector2 v)
        {
            if (Mathf.Abs(v.x) > Mathf.Abs(v.y)) return v.x < 0 ? Dir.Left : Dir.Right;
            return v.y < 0 ? Dir.Up : Dir.Down;
        }
    }
}
