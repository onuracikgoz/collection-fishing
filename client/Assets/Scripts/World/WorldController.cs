using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Collection;
using CollectionGame.Economy;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.Social;
using CollectionGame.UI;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.World
{
    /// <summary>
    /// The map while connected to one server (world match): reads match messages,
    /// keeps our predicted character and everyone else in view, follows us with
    /// the camera and handles chat (Enter to type, Enter to send, Esc to cancel).
    /// Fishing lives in <see cref="FishingController"/>.
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

        FishingController fishing;
        CollectionController collection;
        SocialController social;
        EconomyController economy;
        TradeController trade;
        MarketController market;
        QuestController quests;
        WhisperController whispers;
        SettingsController settings;
        WorldHud hud;
        FishingHud fishingHud;
        BagPanel bagPanel;
        NpcController npcs;
        bool inputLatched;

        /// <param name="switchServer">Joins another server beside a friend: (matchId, serverName, friendUserId).</param>
        public static WorldController Create(Connection net, string serverName, Action<string> onDisconnected, Action<string, string, string> switchServer)
        {
            var go = new GameObject("World");
            var world = go.AddComponent<WorldController>();
            world.net = net;
            world.serverName = serverName;
            world.onDisconnected = onDisconnected;
            world.social = new SocialController(net, switchServer);
            world.collection = new CollectionController(net) { AddFriend = world.social.AddFriend };
            world.fishing = new FishingController(net, go.transform, world.PositionOf, () => world.mover != null && world.mover.Synced);
            world.economy = new EconomyController(net, world.fishing, () => world.mover?.Position) { Crafted = world.collection.OnFishEnd };
            world.whispers = new WhisperController(net);
            world.trade = new TradeController(net, world.fishing, () => world.economy.Prices) { BookOutcome = world.collection.OnFishEnd };
            world.market = new MarketController(net, world.fishing, () => world.economy.Prices, () => world.mover?.Position)
            {
                OpenProfile = world.collection.OpenProfile,
                Whisper = world.whispers.OpenWith,
                AddFriend = world.social.AddFriend,
                BookOutcome = world.collection.OnFishEnd,
            };
            world.quests = new QuestController(net, world.fishing);
            world.npcs = new NpcController(go.transform);
            world.settings = new SettingsController(net)
            {
                BlockedCount = () => world.social.Friends.Count(f => f.State == Connection.FriendBlocked),
                OpenBlocked = () =>
                {
                    world.social.FriendsOpen = true;
                    world.social.Refresh();
                },
                Logout = () => onDisconnected?.Invoke("Çıkış yaptın"),
            };
            world.collection.OfferTrade = world.trade.Offer;
            world.collection.Whisper = (id, name) => world.whispers.OpenWith(id, name);
            world.BuildHud();
            go.AddComponent<MapView>();
            return world;
        }

        // ---- used by the autopilot (Dev/Autopilot.cs) ----
        public bool Ready => mover != null;
        public Vector2 MyPosition => mover?.Position ?? Vector2.zero;
        public string MyFacing => mover?.Facing ?? Dir.Down;
        public bool Walking => mover != null && (mover.Target.HasValue || mover.Moving);
        public int OthersInView => others.Count;
        public IEnumerable<string> OtherIds => others.Keys;
        public FishingController Fishing => fishing;
        public CollectionController Collection => collection;
        public SocialController Social => social;
        public EconomyController Economy => economy;
        public TradeController Trade => trade;
        public MarketController Market => market;
        public QuestController Quests => quests;
        public WhisperController Whispers => whispers;
        public SettingsController Settings => settings;
        public Connection Net => net;

        /// <summary>The chat line, a uGUI field or any IMGUI text field has the keyboard: game keys are off.</summary>
        bool Typing => (hud != null && hud.ChatFocused) || UiRoot.Typing || GUIUtility.keyboardControl != 0;

        /// <summary>No walking or casting: typing, or a window is open (UiRoot.BlocksWorld).</summary>
        bool WorldBlocked => Typing || UiRoot.BlocksWorld;

        void BuildHud()
        {
            hud = new WorldHud
            {
                Submit = text =>
                {
                    if (!whispers.TryCommand(text)) net.Send(OpCode.Say, new SayMsg { text = text });
                },
            };
            bagPanel = new BagPanel(net, fishing, trade, () => economy.Prices, hud.Popup);
            fishingHud = new FishingHud();
            trade.Popup = hud.Popup;
            trade.DistanceTo = id =>
            {
                var them = PositionOf(id);
                return them.HasValue && mover != null ? Vector2.Distance(them.Value, mover.Position) : (float?)null;
            };
            market.Popup = hud.Popup;
            collection.Popup = hud.Popup;
            social.Popup = hud.Popup;
            economy.Popup = hud.Popup;
            // NPC windows open only next to their NPC (E or a click), see NpcController.
            npcs.Bind("quests", new NpcController.Window { IsOpen = () => quests.Open, Open = () => quests.Open = true, Close = () => quests.Open = false });
            npcs.Bind("merchant", new NpcController.Window { IsOpen = () => economy.MerchantOpen, Open = () => economy.Show(EconomyController.Tab.Sell), Close = economy.Hide });
            npcs.Bind("crafter", new NpcController.Window { IsOpen = () => economy.CrafterOpen, Open = () => economy.Show(EconomyController.Tab.Craft), Close = economy.Hide });
            npcs.Bind("banker", new NpcController.Window { IsOpen = () => economy.BankOpen, Open = () => economy.Show(EconomyController.Tab.Stash), Close = economy.Hide });
            social.Whisper = (id, name) => whispers.OpenWith(id, name);
            social.OpenProfile = collection.OpenProfile;
            social.OpenBook = collection.OpenBook;
            social.PmOff = () => settings.PmOff;
            social.SetPmOff = settings.SetPm;
            var v = hud.View;
            if (v == null) return;
            WorldHud.On(v.emote, () => social.EmoteMenuOpen = !social.EmoteMenuOpen);
            WorldHud.On(v.market, () =>
            {
                if (market.Open) market.Open = false;
                else market.Show(MarketController.Tab.Stall);
            });
            WorldHud.On(v.friends, () =>
            {
                social.FriendsOpen = !social.FriendsOpen;
                if (social.FriendsOpen) social.Refresh();
            });
            WorldHud.On(v.profile, () =>
            {
                if (collection.ProfileOpen) collection.ProfileOpen = false;
                else collection.OpenProfile(null);
            });
            WorldHud.On(v.book, () =>
            {
                if (collection.BookOpen) collection.BookOpen = false;
                else collection.OpenBook(null, net.Username);
            });
            WorldHud.On(v.bag, () =>
            {
                fishing.BagOpen = !fishing.BagOpen;
                if (fishing.BagOpen) fishing.RefreshBag();
            });
            WorldHud.On(v.settings, settings.Toggle);
            WorldHud.On(v.repair, () =>
            {
                if (mover == null || !npcs.TalkIfNear("merchant", mover.Position, () => economy.Show(EconomyController.Tab.Shop)))
                    Toasts.Show("Olta tamiri Balıkçı Tüccar'da: yanına git", true);
            });
            v.bait.Clicked = _ => fishing.CycleBait();
        }

        void OnDestroy()
        {
            hud?.Destroy();
            fishingHud?.Destroy();
            bagPanel?.Destroy();
            quests?.Destroy();
            npcs?.Destroy();
            collection?.Destroy();
            social?.Destroy();
            social?.DestroyEmotes();
            economy?.Destroy();
            settings?.Destroy();
            trade?.Destroy();
            market?.Destroy();
            whispers?.Destroy();
        }
        public void WalkTo(Vector2 target) => mover?.SetTarget(target);
        public void Say(string text) => net.Send(OpCode.Say, new SayMsg { text = text });
        public int Corrections { get; private set; }
        public int BubblesHeard { get; private set; }

        Vector2? PositionOf(string id)
        {
            if (id == net.UserId) return mover?.Position;
            return others.TryGetValue(id, out var o) ? o.mover.Position : (Vector2?)null;
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
            while (net.TryDequeueNotice(out var n)) HandleNotice(n);

            var now = Time.time;
            if (mover != null)
            {
                // Keys or the mouse button still held from before a cast must not walk
                // (walking reels the line in): they count again once released.
                var blocked = WorldBlocked;
                var keys = Typing ? Vector2.zero : ReadKeys();
                var mouseHeld = Mouse.current != null && Mouse.current.leftButton.isPressed;
                // The trade window holds both players in place (the server ignores MOVE and CAST);
                // an open window holds this player. Keys or a click held from then count after release.
                if (fishing.BlocksMovement || trade.Active || blocked) inputLatched = true;
                else if (inputLatched && keys == Vector2.zero && !mouseHeld) inputLatched = false;
                var frozen = fishing.BlocksMovement || trade.Active || blocked || inputLatched;
                if (frozen) mover.ClearTarget();
                else ReadMouse();
                var move = mover.Tick(frozen ? Vector2.zero : keys, Time.deltaTime, now);
                if (move != null) net.Send(OpCode.Move, move);
                me.SetState(mover.Position, mover.Facing, mover.Moving);
                fishing.Update(mover.Position, mover.Facing, Typing || trade.Active, blocked, cam);
                fishingHud.Tick(cam, me.transform.position, mover.Position, fishing);
                collection.Update(Typing);
                social.Update(Typing);
                economy.Update(Typing);
                market.Update(Typing);
                npcs.Update(mover.Position, Typing);
                bagPanel.Update();
                quests.Tick();
                collection.Tick();
                social.Tick();
                social.TickEmotes();
                economy.Tick();
                Toasts.Tick();
                if (social.FriendsOpen && settings.PmNeedsLoad) settings.LoadPm();
                settings.Tick();
                trade.Tick();
                market.Tick();
                whispers.Tick();
                npcs.QuestsReady = quests.State != null && quests.State.complete && !quests.State.claimed;
                hud.Tick(serverName, others.Count + 1, fishing);
                if (!Typing) hud.TryOpenChat();
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
                    fishing.OnWelcome(w);
                    economy.OnWelcome();
                    social.OnWelcome(w, net.UserId);
                    collection.LoadMine();
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
                    fishing.OnPlayerEnter(e);
                    social.OnPlayerEnter(e);
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
                    fishing.RemoveBobber(l.id);
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
                    {
                        Corrections++;
                        Debug.Log($"[World] CORRECTION seq {c.seq} → ({c.x:0.##}, {c.y:0.##})");
                    }
                    break;
                }
                case OpCode.Bobber:
                    fishing.OnBobber(JsonUtility.FromJson<BobberMsg>(m.Json), net.UserId);
                    break;
                case OpCode.ReelStart:
                    fishing.OnReelStart(JsonUtility.FromJson<ReelStartMsg>(m.Json));
                    break;
                case OpCode.FishEnd:
                {
                    var f = JsonUtility.FromJson<FishEndMsg>(m.Json);
                    others.TryGetValue(f.id ?? "", out var who);
                    fishing.OnFishEnd(f, net.UserId, who.view);
                    if (f.id == net.UserId)
                    {
                        collection.OnFishEnd(f);
                        market.OnFishEnd(f);
                    }
                    break;
                }
                case OpCode.BookResult:
                    collection.OnBookResult(JsonUtility.FromJson<BookResultMsg>(m.Json));
                    break;
                case OpCode.EconomyResult:
                    economy.OnEconomyResult(JsonUtility.FromJson<EconomyResultMsg>(m.Json));
                    break;
                case OpCode.CraftResult:
                    economy.OnCraftResult(JsonUtility.FromJson<CraftResultMsg>(m.Json));
                    break;
                case OpCode.ShopResult:
                    economy.OnShopResult(JsonUtility.FromJson<ShopResultMsg>(m.Json));
                    break;
                case OpCode.StashResult:
                    economy.OnStashResult(JsonUtility.FromJson<StashResultMsg>(m.Json));
                    break;
                case OpCode.Teleport:
                {
                    var t = JsonUtility.FromJson<TeleportMsg>(m.Json);
                    if (string.IsNullOrEmpty(t.reason) && mover != null)
                    {
                        mover.Teleport(new Vector2(t.x, t.y));
                        me.SetState(mover.Position, mover.Facing, false);
                    }
                    if (!market.OnTeleport(t)) social.OnTeleport(t);
                    break;
                }
                case OpCode.EmoteShow:
                {
                    var e = JsonUtility.FromJson<EmoteShowMsg>(m.Json);
                    var who = e.id == net.UserId ? me : others.TryGetValue(e.id ?? "", out var o) ? o.view : null;
                    social.OnEmote(e, who);
                    break;
                }
                case OpCode.ItemLockResult:
                    bagPanel.OnLockResult(JsonUtility.FromJson<ItemLockResultMsg>(m.Json));
                    break;
                case OpCode.EmoteStatusShow:
                    social.OnStatus(JsonUtility.FromJson<EmoteStatusShowMsg>(m.Json), net.UserId);
                    break;
                case OpCode.Announce:
                {
                    var a = JsonUtility.FromJson<AnnounceMsg>(m.Json);
                    var cond = economy.Prices != null ? Prices.ConditionName(a.condition) : a.condition;
                    Toasts.Announce(a.name, $"{a.tier} {FishingController.ItemName(a.defId)}", cond);
                    break;
                }
                case OpCode.TradeInvite:
                    trade.OnInvite(JsonUtility.FromJson<TradeInviteMsg>(m.Json));
                    break;
                case OpCode.TradeState:
                    trade.OnState(JsonUtility.FromJson<TradeStateMsg>(m.Json));
                    break;
                case OpCode.TradeEnd:
                    trade.OnEnd(JsonUtility.FromJson<TradeEndMsg>(m.Json));
                    break;
                case OpCode.StallState:
                    market.OnStallState(JsonUtility.FromJson<StallsMsg>(m.Json));
                    break;
                case OpCode.StallList:
                    market.OnStallList(JsonUtility.FromJson<StallListMsg>(m.Json));
                    break;
                case OpCode.StallResult:
                    market.OnStallResult(JsonUtility.FromJson<StallResultMsg>(m.Json));
                    break;
                case OpCode.BoardState:
                    market.OnBoardState(JsonUtility.FromJson<BoardStateMsg>(m.Json));
                    break;
                case OpCode.BoardResult:
                    market.OnBoardResult(JsonUtility.FromJson<BoardResultMsg>(m.Json));
                    break;
                case OpCode.QuestState:
                    quests.OnState(JsonUtility.FromJson<QuestStateMsg>(m.Json));
                    break;
                case OpCode.QuestClaimResult:
                    quests.OnClaimResult(JsonUtility.FromJson<QuestClaimResultMsg>(m.Json));
                    break;
                case OpCode.Bubble:
                {
                    var b = JsonUtility.FromJson<BubbleMsg>(m.Json);
                    BubblesHeard++;
                    if (b.id == net.UserId)
                    {
                        me?.Say(b.text, BubbleSeconds);
                        hud.AddLog(net.Username, b.text, "f9c22b");
                    }
                    else if (others.TryGetValue(b.id, out var o))
                    {
                        o.view.Say(b.text, BubbleSeconds);
                        hud.AddLog(o.view.DisplayName, b.text, "8fd3ff");
                    }
                    break;
                }
            }
        }

        /// <summary>Nakama's own friend notifications: a request came in, a request was accepted.</summary>
        const int FriendRequestCode = -2, FriendAcceptedCode = -3;

        [Serializable]
        class FriendNotice
        {
            public string username;
        }

        /// <summary>Live Nakama notifications (docs/protokol.md, bildirim kodları).</summary>
        void HandleNotice(Connection.Notice n)
        {
            switch (n.Code)
            {
                case NotifyCode.Whisper:
                    whispers.OnWhisper(JsonUtility.FromJson<WhisperNotice>(n.Json));
                    break;
                case NotifyCode.StallSold:
                    market.OnSold(JsonUtility.FromJson<StallSoldNotice>(n.Json));
                    break;
                case NotifyCode.DeletionCancelled:
                    settings.OnDeletionCancelled();
                    break;
                case FriendRequestCode:
                {
                    var who = JsonUtility.FromJson<FriendNotice>(string.IsNullOrEmpty(n.Json) ? "{}" : n.Json)?.username ?? "Bir oyuncu";
                    var id = n.SenderId;
                    Toasts.Notify($"{who} arkadaş istedi", null, Toasts.Kind.Info, "Kabul", () => social.AddFriend(id, who));
                    if (social.FriendsOpen) social.Refresh();
                    break;
                }
                case FriendAcceptedCode:
                {
                    var who = JsonUtility.FromJson<FriendNotice>(string.IsNullOrEmpty(n.Json) ? "{}" : n.Json)?.username ?? "Bir oyuncu";
                    Toasts.Show($"{who} arkadaşlığını kabul etti");
                    break;
                }
                case NotifyCode.LoginLinked:
                    Toasts.Show("Hesabına yeni bir giriş yolu bağlandı");
                    break;
                case NotifyCode.LoginUnlinked:
                    Toasts.Show("Hesabından bir giriş yolu kaldırıldı");
                    break;
                default:
                    Debug.Log($"[World] notification {n.Code} {n.Subject} {n.Json}");
                    break;
            }
        }

        /// <summary>Click on another player's name (oyuncu-kart): what can be done with them.</summary>
        void PlayerMenu(string id, string name)
        {
            var friend = social.Friends.Any(f => f.UserId == id && f.State == Connection.FriendMutual);
            hud.Popup.ShowMenu(name, new (string, Action)[]
            {
                ("Profil", () => collection.OpenProfile(id)),
                ("Defterine bak", () => collection.OpenBook(id, name)),
                (friend ? "Arkadaşın" : "<color=#91db69>Arkadaş ekle</color>", friend ? (Action)null : () => social.AddFriend(id, name)),
                ("Fısılda", () => whispers.OpenWith(id, name)),
                ("Takas teklif et", () => trade.Offer(id, name)),
                ("Engelle", () => Block(id, name)),
                ("<color=#e83b3b>Şikayet et</color>", () => collection.ReportMenu(id)),
            });
        }

        async void Block(string id, string name)
        {
            try
            {
                await net.BlockAsync(id);
                Toasts.Show($"{name} engellendi");
                social.Refresh();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[World] block failed: {e.Message}");
                Toasts.Show("Engellenemedi", true);
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
            // Clicks on the HUD, windows and name tags are not walking.
            if (UiRoot.PointerOverUi || Gui.IsOverUi(screen)) return;
            GUIUtility.keyboardControl = 0; // clicking the world leaves a text field
            var world = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, -cam.transform.position.z));
            var point = Coords.ToServer(world);
            // A click on an NPC walks there and talks on arrival.
            if (mouse.leftButton.wasPressedThisFrame && npcs.Click(point, mover.Position)) { }
            else if (mouse.leftButton.wasPressedThisFrame) npcs.CancelWalk();
            mover.SetTarget(point);
        }

        void OnGUI()
        {
            Gui.Begin();
            DrawLabels();
            DrawHud();
        }

        void DrawLabels()
        {
            if (cam == null) return;
            economy.DrawMarkers(cam);
            market.DrawMarkers(cam);
            if (me != null) DrawLabel(me, true);
            if (npcs != null && mover != null)
                foreach (var view in npcs.Views) DrawNpcLabel(view);
            foreach (var (view, _) in others.Values)
                if (ClientSettings.ShowNames) DrawLabel(view, false);
        }

        void DrawNpcLabel(CharacterView view)
        {
            var label = npcs.Label(view, mover.Position);
            var at = Gui.ToGui(cam.WorldToScreenPoint(view.transform.position + new Vector3(0f, 1.75f, 0f)));
            var size = Gui.NameMe.CalcSize(new GUIContent(label)) + new Vector2(6f, 4f);
            var r = new Rect(at.x - size.x / 2f, at.y - size.y, size.x, size.y);
            if (UiRoot.Covers(Gui.ToScreen(r.center))) return;
            GUI.Label(new Rect(r.x + 1, r.y + 1, r.width, r.height), label, Gui.Shadow);
            GUI.Label(r, label, Gui.NameMe);
            Gui.Block(r);
            if (GUI.Button(r, GUIContent.none, GUIStyle.none)) npcs.Click(view.ServerPos, mover.Position);
        }

        void DrawLabel(CharacterView view, bool isMe)
        {
            var feet = view.transform.position;
            var namePos = Gui.ToGui(cam.WorldToScreenPoint(feet + new Vector3(0f, 1.75f, 0f)));
            var nameStyle = isMe ? Gui.NameMe : Gui.Name;
            var nameSize = nameStyle.CalcSize(new GUIContent(view.DisplayName)) + new Vector2(6f, 4f);
            var nameRect = new Rect(namePos.x - nameSize.x / 2f, namePos.y - nameSize.y, nameSize.x, nameSize.y);
            // Behind a uGUI window: no name, emote or bubble drawn over it.
            if (UiRoot.Covers(Gui.ToScreen(nameRect.center))) return;
            GUI.Label(new Rect(nameRect.x + 1, nameRect.y + 1, nameRect.width, nameRect.height), view.DisplayName, Gui.Shadow);
            GUI.Label(nameRect, view.DisplayName, nameStyle);
            // Click a name to see that player's profile card.
            Gui.Block(nameRect);
            if (GUI.Button(nameRect, GUIContent.none, GUIStyle.none))
            {
                if (isMe) collection.OpenProfile(null);
                else PlayerMenu(view.Id, view.DisplayName);
            }

            // Status emote (emote-dunya): a small sign above the name until removed.
            if (social.StatusOf.TryGetValue(view.Id, out var status) && !string.IsNullOrEmpty(status))
            {
                var label = SocialController.StatusName(status);
                var size = Gui.Bubble.CalcSize(new GUIContent(label)) + new Vector2(6f, 0f);
                GUI.Box(new Rect(namePos.x - size.x / 2f, nameRect.y - size.y - 2f, size.x, size.y), label, Gui.Bubble);
                namePos.y -= size.y + 2f; // a chat bubble goes above it
            }

            if (view.EmoteText != null && Time.time < view.EmoteTextUntil)
            {
                // Emotes are written under the feet, so they never cover a chat bubble.
                var at = Gui.ToGui(cam.WorldToScreenPoint(feet));
                var text = $"*{view.EmoteText}*";
                var size = Gui.Emote.CalcSize(new GUIContent(text)) + new Vector2(6f, 2f);
                GUI.Label(new Rect(at.x - size.x / 2f + 1, at.y + 1, size.x, size.y), text, Gui.Shadow);
                GUI.Label(new Rect(at.x - size.x / 2f, at.y, size.x, size.y), text, Gui.Emote);
            }

            if (!ClientSettings.Bubbles || view.Bubble == null || Time.time > view.BubbleUntil) return;
            var content = new GUIContent(view.Bubble);
            // A few pixels of slack: the scaled GUI matrix rounds text wider than CalcSize says.
            var width = Mathf.Min(240f, Gui.Bubble.CalcSize(content).x + 8f);
            var height = Gui.Bubble.CalcHeight(content, width) + 2f;
            GUI.Box(new Rect(namePos.x - width / 2f, namePos.y - nameSize.y - height - 4f, width, height), content, Gui.Bubble);
        }

        void DrawHud()
        {
            if (mover == null) GUI.Label(new Rect(10, 80, 400, 24), "Bağlanıyor...", Gui.HudBold);
            if (mover != null)
            {
                fishing.DrawGui(mover.Position);
                collection.DrawGui();
                social.DrawGui();
                economy.DrawGui();
            }

        }
    }
}
