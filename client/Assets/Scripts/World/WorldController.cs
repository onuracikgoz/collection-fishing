using System;
using System.Collections.Generic;
using CollectionGame.Net;
using CollectionGame.UI;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.World
{
    /// <summary>
    /// The map while connected to one server (world match): reads match messages,
    /// keeps our predicted character and everyone else in view, follows us with
    /// the camera and handles chat (Enter to type, Enter to send, Esc to cancel).
    /// </summary>
    public class WorldController : MonoBehaviour
    {
        const float BubbleSeconds = 6f;
        const int ChatMaxLength = 120; // server trims too (docs/protokol.md)

        Connection net;
        string serverName;
        Action<string> onDisconnected;

        Camera cam;
        CharacterView me;
        LocalMover mover;
        readonly Dictionary<string, (CharacterView view, RemoteMover mover)> others = new Dictionary<string, (CharacterView, RemoteMover)>();

        bool chatOpen;
        bool focusChat;
        string chatText = "";

        public static WorldController Create(Connection net, string serverName, Action<string> onDisconnected)
        {
            var go = new GameObject("World");
            var world = go.AddComponent<WorldController>();
            world.net = net;
            world.serverName = serverName;
            world.onDisconnected = onDisconnected;
            go.AddComponent<MapView>();
            return world;
        }

        void Start()
        {
            cam = Camera.main;
            if (cam == null) cam = new GameObject("Main Camera", typeof(Camera)).GetComponent<Camera>();
            cam.orthographic = true;
            cam.backgroundColor = new Color(0.13f, 0.2f, 0.13f);
            cam.clearFlags = CameraClearFlags.SolidColor;
        }

        void Update()
        {
            if (net.ClosedReason != null)
            {
                onDisconnected?.Invoke(net.ClosedReason);
                return;
            }

            while (net.TryDequeue(out var m)) Handle(m);

            var now = Time.time;
            if (mover != null)
            {
                ReadMouse();
                var move = mover.Tick(chatOpen ? Vector2.zero : ReadKeys(), Time.deltaTime, now);
                if (move != null) net.Send(OpCode.Move, move);
                me.SetState(mover.Position, mover.Facing, mover.Moving);
            }

            foreach (var (view, remote) in others.Values)
            {
                remote.Update(now);
                view.SetState(remote.Position, remote.Facing, remote.Moving);
            }
        }

        void LateUpdate()
        {
            if (cam == null || me == null) return;
            // Integer zoom keeps the pixel art sharp: one art pixel = zoom screen pixels.
            var zoom = Mathf.Max(1, Mathf.RoundToInt(Screen.height / 480f));
            cam.orthographicSize = Screen.height / (2f * 32f * zoom);
            var halfH = cam.orthographicSize;
            var halfW = halfH * cam.aspect;
            var p = me.transform.position;
            var x = LakeMap.Width > 2 * halfW ? Mathf.Clamp(p.x, halfW, LakeMap.Width - halfW) : LakeMap.Width / 2f;
            var y = LakeMap.Height > 2 * halfH ? Mathf.Clamp(p.y, -LakeMap.Height + halfH, -halfH) : -LakeMap.Height / 2f;
            var snap = 1f / (32f * zoom);
            cam.transform.position = new Vector3(Mathf.Round(x / snap) * snap, Mathf.Round(y / snap) * snap, -10f);
        }

        void Handle(Connection.Incoming m)
        {
            var now = Time.time;
            switch (m.Op)
            {
                case OpCode.Welcome:
                {
                    var w = JsonUtility.FromJson<WelcomeMsg>(m.Json);
                    serverName = w.serverName;
                    var start = new Vector2(w.you.x, w.you.y);
                    mover = new LocalMover(start);
                    if (me == null) me = CharacterView.Create(transform, w.you.id, net.Username);
                    me.SetState(start, mover.Facing, false);
                    break;
                }
                case OpCode.PlayerEnter:
                {
                    var e = JsonUtility.FromJson<PlayerEnterMsg>(m.Json);
                    if (e.id == net.UserId) break;
                    if (others.TryGetValue(e.id, out var known))
                    {
                        known.mover.Reset(e, now);
                        break;
                    }
                    var view = CharacterView.Create(transform, e.id, e.name);
                    var remote = new RemoteMover(e, now);
                    view.SetState(remote.Position, remote.Facing, remote.Moving);
                    others[e.id] = (view, remote);
                    break;
                }
                case OpCode.PlayerLeave:
                {
                    var l = JsonUtility.FromJson<PlayerLeaveMsg>(m.Json);
                    if (others.TryGetValue(l.id, out var gone))
                    {
                        Destroy(gone.view.gameObject);
                        others.Remove(l.id);
                    }
                    break;
                }
                case OpCode.Snapshot:
                {
                    var s = JsonUtility.FromJson<SnapshotMsg>(m.Json);
                    if (s.players == null) break;
                    foreach (var p in s.players)
                        if (others.TryGetValue(p.id, out var o)) o.mover.Push(p, now);
                    break;
                }
                case OpCode.Correction:
                {
                    var c = JsonUtility.FromJson<CorrectionMsg>(m.Json);
                    if (mover != null && mover.ApplyCorrection(c))
                        Debug.Log($"[World] CORRECTION seq {c.seq} → ({c.x:0.##}, {c.y:0.##})");
                    break;
                }
                case OpCode.Bubble:
                {
                    var b = JsonUtility.FromJson<BubbleMsg>(m.Json);
                    if (b.id == net.UserId) me?.Say(b.text, BubbleSeconds);
                    else if (others.TryGetValue(b.id, out var o)) o.view.Say(b.text, BubbleSeconds);
                    break;
                }
            }
        }

        static Vector2 ReadKeys()
        {
            var k = Keyboard.current;
            if (k == null) return Vector2.zero;
            var v = Vector2.zero;
            if (k.aKey.isPressed || k.leftArrowKey.isPressed) v.x -= 1;
            if (k.dKey.isPressed || k.rightArrowKey.isPressed) v.x += 1;
            if (k.wKey.isPressed || k.upArrowKey.isPressed) v.y -= 1; // server y grows down
            if (k.sKey.isPressed || k.downArrowKey.isPressed) v.y += 1;
            return v;
        }

        void ReadMouse()
        {
            var mouse = Mouse.current;
            if (mouse == null || cam == null || !mouse.leftButton.isPressed) return;
            var screen = mouse.position.ReadValue();
            // Clicks on the chat box are not walking.
            if (Gui.ToGui(screen).y > Gui.Height - 60f) return;
            var world = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, -cam.transform.position.z));
            mover.SetTarget(Coords.ToServer(world));
        }

        void OnGUI()
        {
            Gui.Begin();
            DrawLabels();
            DrawHud();
            DrawChat();
        }

        void DrawLabels()
        {
            if (cam == null) return;
            if (me != null) DrawLabel(me, true);
            foreach (var (view, _) in others.Values) DrawLabel(view, false);
        }

        void DrawLabel(CharacterView view, bool isMe)
        {
            var feet = view.transform.position;
            var namePos = Gui.ToGui(cam.WorldToScreenPoint(feet + new Vector3(0f, 1.75f, 0f)));
            var nameStyle = isMe ? Gui.NameMe : Gui.Name;
            var nameSize = nameStyle.CalcSize(new GUIContent(view.DisplayName));
            var nameRect = new Rect(namePos.x - nameSize.x / 2f, namePos.y - nameSize.y, nameSize.x, nameSize.y);
            GUI.Label(new Rect(nameRect.x + 1, nameRect.y + 1, nameRect.width, nameRect.height), view.DisplayName, Gui.Shadow);
            GUI.Label(nameRect, view.DisplayName, nameStyle);

            if (view.Bubble == null || Time.time > view.BubbleUntil) return;
            var content = new GUIContent(view.Bubble);
            var width = Mathf.Min(240f, Gui.Bubble.CalcSize(content).x);
            var height = Gui.Bubble.CalcHeight(content, width);
            GUI.Box(new Rect(namePos.x - width / 2f, namePos.y - nameSize.y - height - 4f, width, height), content, Gui.Bubble);
        }

        void DrawHud()
        {
            var info = mover == null ? "Bağlanıyor…" : $"{serverName} · {others.Count + 1} kişi görüşte";
            GUI.Label(new Rect(10, 8, 400, 24), info, Gui.Hud);
            if (!chatOpen) GUI.Label(new Rect(10, Gui.Height - 30, 600, 24), "WASD / tıkla: yürü · Enter: konuş", Gui.Hud);
        }

        void DrawChat()
        {
            var e = Event.current;
            var enter = e.type == EventType.KeyDown && (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter);
            if (!chatOpen)
            {
                if (enter && mover != null)
                {
                    chatOpen = true;
                    focusChat = true;
                    chatText = "";
                    e.Use();
                }
                return;
            }

            if (enter)
            {
                var text = chatText.Trim();
                if (text.Length > 0) net.Send(OpCode.Say, new SayMsg { text = text });
                chatOpen = false;
                GUI.FocusControl(null);
                e.Use();
                return;
            }
            if (e.type == EventType.KeyDown && e.keyCode == KeyCode.Escape)
            {
                chatOpen = false;
                GUI.FocusControl(null);
                e.Use();
                return;
            }

            GUI.SetNextControlName("chat");
            chatText = GUI.TextField(new Rect(10, Gui.Height - 44, Mathf.Min(600, Gui.Width - 20), 32), chatText, ChatMaxLength, Gui.Input);
            if (focusChat)
            {
                GUI.FocusControl("chat");
                focusChat = false;
            }
        }
    }
}
