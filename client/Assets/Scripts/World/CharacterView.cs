using System.Collections.Generic;
using CollectionGame.Art;
using CollectionGame.Net;
using CollectionGame.Wardrobe;
using UnityEngine;
using UnityEngine.Rendering;

namespace CollectionGame.World
{
    /// <summary>
    /// One character on screen: LPC layers stacked in a SortingGroup, Walk / Idle
    /// animation in four directions, plus the name and chat bubble that
    /// <see cref="WorldController"/> draws above the head.
    ///
    /// Universal LPC layers from the server's look (Gardırop, <see cref="LpcLook"/>): 64×64 frames,
    /// rows top to bottom = up, left, down, right. Feet are at the bottom of the frame (2 px margin),
    /// so the pivot sits there.
    /// </summary>
    public class CharacterView : MonoBehaviour
    {
        const int Frame = LpcLook.Frame;
        const float WalkFps = 10f;
        const float IdleFps = 2f;
        const float FeetPivot = 2f / Frame;

        SpriteRenderer[] layers = new SpriteRenderer[0];
        List<LpcLook.Layer> lookLayers = new List<LpcLook.Layer>();
        SortingGroup group;
        /// <summary>The worn look as the server sent it (null until it did).</summary>
        public LookView Look { get; private set; }
        float animTime;
        bool wasMoving;

        public string Id { get; private set; }
        public string DisplayName { get; set; }
        /// <summary>Chat lines over the head, oldest first; World/ChatBubbles draws them as a stack.</summary>
        public readonly List<BubbleLine> Bubbles = new List<BubbleLine>();
        public const int MaxBubbles = 5;
        /// <summary>Screen point (pixels, origin bottom left) the bubble stack stands on: above the name.</summary>
        public Vector2 BubbleAnchor { get; set; }

        public sealed class BubbleLine
        {
            public string Text;
            public float Born, Until;
        }
        public Vector2 ServerPos { get; private set; }
        public string Facing { get; private set; } = Dir.Down;
        public bool Moving { get; private set; }

        public static CharacterView Create(Transform parent, string id, string name, LookView look)
        {
            var go = new GameObject($"Player {name}");
            go.transform.SetParent(parent, false);
            var view = go.AddComponent<CharacterView>();
            view.DisplayName = name;
            view.Id = id;
            view.group = go.AddComponent<SortingGroup>();
            view.SetLook(look);
            return view;
        }

        /// <summary>Wears a new look (WELCOME, PLAYER_ENTER, LOOK_SHOW, the wardrobe's try-on).</summary>
        public void SetLook(LookView look)
        {
            Look = look;
            lookLayers = LpcLook.Layers(look);
            foreach (var l in layers)
                if (l != null) Destroy(l.gameObject);
            layers = new SpriteRenderer[lookLayers.Count];
            for (var i = 0; i < lookLayers.Count; i++)
            {
                var layer = new GameObject(lookLayers[i].PartId);
                layer.transform.SetParent(transform, false);
                layers[i] = layer.AddComponent<SpriteRenderer>();
                layers[i].sortingOrder = i;
            }
            Draw();
        }

        /// <summary>Sprites lower on screen (bigger server y) draw in front.</summary>
        public static int SortingOrderFor(float serverY) => Mathf.RoundToInt(serverY * 16f);

        public void SetState(Vector2 serverPos, string facing, bool moving)
        {
            ServerPos = serverPos;
            if (!string.IsNullOrEmpty(facing)) Facing = facing;
            Moving = moving;
            transform.position = Coords.ToUnity(serverPos);
            group.sortingOrder = SortingOrderFor(serverPos.y);
            if (Seat != null)
            {
                // Our own walk stands up at once (the server confirms with SEAT_SHOW ""). Others stay
                // seated until the server says they stood up.
                if (moving && IsLocal) StandUp();
                else ApplySeat();
            }
        }

        // Chair seats (protokol.md, Oturma); the chairs themselves are still the TEMP MapView preview.
        public MapView.MapSeat Seat { get; private set; }
        public bool IsLocal;

        public void SitOn(MapView.MapSeat seat)
        {
            Seat = seat;
            Emote = Emotes.Sit;
            animTime = 0f;
            ApplySeat();
        }

        public void StandUp()
        {
            if (Seat == null) return;
            Seat = null;
            if (Emote == Emotes.Sit) Emote = null;
        }

        void ApplySeat()
        {
            // FramePx puts the frame's bottom-centre; the sprite pivot is FeetPivot above it.
            var px = Seat.FramePx - new Vector2(0f, FeetPivot * Frame);
            transform.position = Coords.ToUnity(Seat.Feet + px / 32f);
            group.sortingOrder = Seat.ChairOrder + (Seat.ChairInFront ? -1 : 1);
        }

        public void Say(string text, float seconds)
        {
            Bubbles.RemoveAll(b => Time.time >= b.Until);
            Bubbles.Add(new BubbleLine { Text = text, Born = Time.time, Until = Time.time + seconds });
            while (Bubbles.Count > MaxBubbles) Bubbles.RemoveAt(0);
        }

        /// <summary>Current emote (EMOTE_SHOW); sit lasts until the character walks.</summary>
        public string Emote { get; private set; }
        public string EmoteText { get; private set; }
        public float EmoteTextUntil { get; private set; }
        float emoteUntil;

        public void ShowEmote(string emote, string text, float seconds)
        {
            Emote = emote;
            EmoteText = text;
            emoteUntil = EmoteTextUntil = Time.time + seconds;
            animTime = 0f;
        }

        void Update()
        {
            if (Moving != wasMoving)
            {
                animTime = 0f;
                wasMoving = Moving;
            }
            animTime += Time.deltaTime;
            if (Emote != null && (Moving || (Emote != Emotes.Sit && Time.time > emoteUntil))) Emote = null;

            Draw();
        }

        void Draw()
        {
            // sit.png has three poses per direction: 0 on the ground (the sit emote), 2 on a chair.
            var sitting = Emote == Emotes.Sit || Seat != null;
            var walking = Moving || Emote == Emotes.Dance;
            var anim = sitting ? LpcLook.Anim.Sit : walking ? LpcLook.Anim.Walk : LpcLook.Anim.Idle;
            var frame = sitting ? 0 : (int)(animTime * (walking ? WalkFps : IdleFps));
            var row = Row(Facing);
            if (Seat != null)
            {
                row = Seat.Row;
                frame = LpcLook.ChairPose;
            }
            for (var i = 0; i < layers.Length; i++)
                layers[i].sprite = LpcLook.Sprite(lookLayers[i], anim, frame, row, FeetPivot);
        }

        static int Row(string dir)
        {
            switch (dir)
            {
                case Dir.Up: return 0;
                case Dir.Left: return 1;
                case Dir.Right: return 3;
                default: return 2;
            }
        }
    }
}
