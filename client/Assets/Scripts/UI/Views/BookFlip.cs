using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace CollectionGame.UI.Views
{
    /// <summary>
    /// Turns the book's pages like a real book: hold a page and drag it over the spine (right page to
    /// the left goes forward, left page to the right goes back), or play the same turn from the arrow
    /// buttons. A blank paper leaf swings around the spine; the turn happens when it passes the middle.
    /// Sits on the "Spread" node that holds both pages (UiPrefabBuilder, BuildBook).
    /// </summary>
    public sealed class BookFlip : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        /// <summary>The paper that swings: pivot on the spine, one page wide. Scale x +1 covers the right page, -1 the left.</summary>
        public RectTransform leaf;
        public UnityEngine.UI.Image leafPaper;
        /// <summary>The spine's middle, in this node's local x (left edge 0).</summary>
        public float spineX = 314f;

        /// <summary>+1 forward, -1 back. Called once per finished turn.</summary>
        public Action<int> Turned;

        const float Speed = 4.5f;          // leaf travel per second when it finishes by itself (1 = a whole turn)
        const float MinPull = 140f;        // a short grab still needs this much drag for a whole turn
        const float FlickSpeed = 900f;     // a fast flick turns even before the middle (kit pixels per second)

        int dir;          // 0 idle, +1 forward, -1 back
        float progress;   // 0 at the start page, 1 on the other side
        float target = -1f;
        bool dragging, committed;
        float grabX, pull, lastX, velocity, lastMove;

        public bool Busy => dir != 0;

        void Awake() => Hide();

        void OnDisable()
        {
            dragging = false;
            Finish(); // a turn that already passed the middle stays turned
        }

        /// <summary>The arrow buttons: the whole turn plays by itself.</summary>
        public void Play(int step)
        {
            if (dir != 0)
            {
                if (dragging) return;
                Finish(); // a second click skips the rest of the running turn
            }
            Begin(step);
            target = 1f;
        }

        public void OnBeginDrag(PointerEventData e)
        {
            if (dir != 0 || !Local(e.pressPosition, e, out var press) || !Local(e.position, e, out var now)) return;
            var d = now - press;
            if (Mathf.Abs(d.x) < Mathf.Abs(d.y)) return; // a vertical drag is not a turn
            var step = press.x > spineX && d.x < 0 ? 1 : press.x < spineX && d.x > 0 ? -1 : 0;
            if (step == 0) return;
            Begin(step);
            dragging = true;
            grabX = lastX = press.x;
            pull = Mathf.Max(MinPull, 2f * Mathf.Abs(press.x - spineX));
            OnDrag(e);
        }

        public void OnDrag(PointerEventData e)
        {
            if (!dragging || !Local(e.position, e, out var p)) return;
            var dt = Mathf.Max(Time.unscaledDeltaTime, 0.001f);
            velocity = Mathf.Lerp(velocity, (p.x - lastX) / dt, 0.5f);
            lastX = p.x;
            lastMove = Time.unscaledTime;
            SetProgress(Mathf.Clamp01(dir * (grabX - p.x) / pull));
        }

        public void OnEndDrag(PointerEventData e)
        {
            if (!dragging) return;
            dragging = false;
            var flick = Time.unscaledTime - lastMove < 0.1f && -dir * velocity > FlickSpeed; // held still = no flick
            target = progress >= 0.5f || flick ? 1f : 0f;
        }

        void Update()
        {
            if (dir == 0 || dragging || target < 0f) return;
            SetProgress(Mathf.MoveTowards(progress, target, Speed * Time.unscaledDeltaTime));
            if (Mathf.Approximately(progress, target)) Finish();
        }

        void Begin(int step)
        {
            dir = step;
            committed = false;
            target = -1f;
            velocity = 0f;
            leaf.gameObject.SetActive(true);
            leaf.SetAsLastSibling();
            SetProgress(0f);
        }

        void SetProgress(float p)
        {
            progress = p;
            // The turn counts once the leaf is past the spine: the pages under it show the new spread.
            if (!committed && p >= 0.5f)
            {
                committed = true;
                Turned?.Invoke(dir);
            }
            else if (committed && p < 0.5f)
            {
                committed = false;
                Turned?.Invoke(-dir); // dragged back over the middle: undo
            }
            var x = 1f - 2f * p;          // +1 .. -1 going forward
            if (dir < 0) x = -x;          // going back the leaf starts on the left
            leaf.localScale = new Vector3(x, 1f, 1f);
            if (leafPaper != null)
            {
                var shade = Mathf.Lerp(1f, 0.72f, Mathf.Sin(p * Mathf.PI)); // darker while the leaf stands up
                leafPaper.color = new Color(shade, shade, shade, 1f);
            }
        }

        void Finish()
        {
            dir = 0;
            target = -1f;
            Hide();
        }

        void Hide()
        {
            if (leaf != null) leaf.gameObject.SetActive(false);
        }

        bool Local(Vector2 screen, PointerEventData e, out Vector2 local)
        {
            var rt = (RectTransform)transform;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(rt, screen, e.pressEventCamera, out local)) return false;
            local.x += rt.pivot.x * rt.rect.width; // left edge = 0
            return true;
        }
    }
}
