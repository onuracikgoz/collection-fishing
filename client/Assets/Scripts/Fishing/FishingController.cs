using System;
using System.Collections.Generic;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.World;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.Fishing
{
    /// <summary>
    /// Phase 2 fishing on the client (docs/protokol.md, Balık tutma). Sends intents
    /// (CAST, HOOK, REEL_DONE, CANCEL), draws bobbers and the reel mini game; every
    /// result comes from the server. Placeholder UI.
    ///
    /// Keys: hold F and release to cast in the facing direction (longer hold =
    /// farther), or right-click on water. Space hooks on a bite and, held, lifts
    /// the reel bar. Esc reels in. B opens the bag.
    /// </summary>
    public sealed class FishingController
    {
        public enum Phase { Idle, Charging, Casting, Waiting, Bite, Hooked, Reeling, Judging }

        // Client-side limits only to avoid pointless casts; the server decides (FISHING config).
        const float NearWater = 1.5f;
        const float MinCast = 1.5f;
        const float MaxCast = 7.5f; // server max 8 (Öneri)
        const float ChargeSeconds = 1.2f;
        const float ToastSeconds = 4f;
        const float ReplyTimeout = 3f;

        readonly Connection net;
        readonly Transform root;
        readonly Func<string, Vector2?> playerPos;
        readonly Func<bool> movementSynced;
        readonly Dictionary<string, BobberView> bobbers = new Dictionary<string, BobberView>();
        readonly List<int> reelInputs = new List<int>();

        public Phase State { get; private set; } = Phase.Idle;
        public int Energy { get; private set; }
        public int EnergyMax { get; private set; }
        public ReelModel Reel { get; private set; }
        public InventoryResponse Bag { get; private set; }
        public bool BagOpen { get; set; }
        public string LastOutcome { get; private set; }
        public FishEndMsg LastEnd { get; private set; }
        /// <summary>Set by the autopilot to hold the reel instead of the keyboard.</summary>
        public Func<ReelModel, bool> BotReel { get; set; }

        /// <summary>No walking while the line is tight; walking while waiting reels in (server cancels).</summary>
        public bool BlocksMovement => State != Phase.Idle && State != Phase.Waiting;

        float charge;
        bool hookedEarly;
        Vector2? pendingCast;
        float stateSince;
        float reelStartedAt;
        bool reelPressed;
        string toast;
        float toastUntil;

        public FishingController(Connection net, Transform root, Func<string, Vector2?> playerPos, Func<bool> movementSynced)
        {
            this.net = net;
            this.root = root;
            this.playerPos = playerPos;
            this.movementSynced = movementSynced;
        }

        public void OnWelcome(WelcomeMsg w)
        {
            Energy = w.energy;
            EnergyMax = w.energyMax;
        }

        // ---------- input ----------

        public void Update(Vector2 me, string facing, bool chatOpen, Camera cam)
        {
            var now = Time.time;
            var k = Keyboard.current;
            var mouse = Mouse.current;
            var typing = chatOpen || k == null;

            if (!typing && k.bKey.wasPressedThisFrame)
            {
                BagOpen = !BagOpen;
                if (BagOpen) RefreshBag();
            }

            switch (State)
            {
                case Phase.Idle:
                    if (typing) break;
                    if (k.fKey.wasPressedThisFrame)
                    {
                        charge = 0f;
                        SetState(Phase.Charging);
                    }
                    else if (mouse != null && mouse.rightButton.wasPressedThisFrame && cam != null)
                    {
                        var screen = mouse.position.ReadValue();
                        var world = cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, -cam.transform.position.z));
                        Cast(Coords.ToServer(world));
                    }
                    break;

                case Phase.Charging:
                    charge = Mathf.Min(1f, charge + Time.deltaTime / ChargeSeconds);
                    if (typing || !k.fKey.isPressed)
                        Cast(me + DirVector(facing) * Mathf.Lerp(MinCast, MaxCast, charge));
                    break;

                case Phase.Casting:
                    // A MOVE still on its way would count as walking and cancel the cast,
                    // so the CAST waits until the server has our final position.
                    if (pendingCast.HasValue && movementSynced())
                    {
                        net.Send(OpCode.Cast, new CastMsg { x = pendingCast.Value.x, y = pendingCast.Value.y });
                        pendingCast = null;
                        stateSince = now;
                    }
                    else if (now - stateSince > ReplyTimeout) Reset("Sunucudan cevap gelmedi");
                    break;

                case Phase.Hooked:
                case Phase.Judging:
                    // Waiting for the server; give up if nothing comes back.
                    if (now - stateSince > ReplyTimeout + (State == Phase.Judging ? 5f : 0f)) Reset("Sunucudan cevap gelmedi");
                    break;

                case Phase.Waiting:
                case Phase.Bite:
                    if (typing) break;
                    if (k.spaceKey.wasPressedThisFrame) Hook();
                    else if (k.escapeKey.wasPressedThisFrame)
                    {
                        net.Send(OpCode.Cancel, new EmptyMsg());
                    }
                    break;

                case Phase.Reeling:
                    StepReel(typing ? false : k.spaceKey.isPressed || (mouse != null && mouse.leftButton.isPressed));
                    break;
            }

            foreach (var pair in bobbers) pair.Value.Tick(playerPos(pair.Key));
        }

        public void Cast(Vector2 target)
        {
            if (State != Phase.Idle && State != Phase.Charging) return;
            pendingCast = target;
            SetState(Phase.Casting);
        }

        public void Hook()
        {
            if (State != Phase.Waiting && State != Phase.Bite) return;
            hookedEarly = State == Phase.Waiting;
            net.Send(OpCode.Hook, new EmptyMsg());
            SetState(Phase.Hooked);
        }

        /// <summary>
        /// Plays the reel game in real time, one 20 ms step at a time. The key is read
        /// once per step and every change is logged as that step's start (k*20 ms),
        /// which is exactly how the server's replay applies it.
        /// </summary>
        void StepReel(bool keyHeld)
        {
            var elapsedMs = (Time.realtimeSinceStartup - reelStartedAt) * 1000f;
            while (!Reel.Done && (Reel.Steps + 1) * ReelModel.StepMs <= elapsedMs)
            {
                var pressed = BotReel != null ? BotReel(Reel) : keyHeld;
                if (pressed != reelPressed)
                {
                    reelPressed = pressed;
                    reelInputs.Add((Reel.Steps + 1) * ReelModel.StepMs);
                }
                Reel.Step(reelPressed);
            }
            if (!Reel.Done) return;
            net.Send(OpCode.ReelDone, new ReelDoneMsg { inputs = reelInputs.ToArray() });
            Debug.Log($"[Fish] REEL_DONE {reelInputs.Count} inputs, local result {(Reel.Caught ? "caught" : "escaped")} at step {Reel.Steps}");
            SetState(Phase.Judging);
        }

        // ---------- server messages ----------

        public void OnBobber(BobberMsg b, string myId)
        {
            if (!bobbers.TryGetValue(b.id, out var view))
            {
                view = BobberView.Create(root, b.id);
                bobbers[b.id] = view;
            }
            view.Set(new Vector2(b.x, b.y), b.state);
            if (b.id != myId) return;
            Debug.Log($"[Fish] BOBBER {b.state} {b.band} ({b.x:0.0}, {b.y:0.0})");
            if (b.state == BobberState.Bite && (State == Phase.Waiting || State == Phase.Casting)) SetState(Phase.Bite);
            else if (b.state == BobberState.Cast && State == Phase.Casting) SetState(Phase.Waiting);
        }

        public void OnReelStart(ReelStartMsg r)
        {
            Reel = new ReelModel((uint)r.seed, r.@params);
            reelInputs.Clear();
            reelPressed = false;
            reelStartedAt = Time.realtimeSinceStartup;
            Debug.Log($"[Fish] REEL_START seed {r.seed}, {r.@params.maxSteps} steps max");
            SetState(Phase.Reeling);
        }

        public void OnFishEnd(FishEndMsg e, string myId, CharacterView who)
        {
            // BUSY refuses a second cast but keeps the first one going.
            var keepsBobber = e.outcome == FishOutcome.Rejected && e.reason == "BUSY";
            if (!keepsBobber) RemoveBobber(e.id);

            if (e.id != myId)
            {
                if (e.outcome == FishOutcome.Caught && !string.IsNullOrEmpty(e.defId)) who?.Say($"Yakaladı: {ItemName(e.defId)}", 4f);
                return;
            }

            Energy = e.energy;
            LastOutcome = e.outcome;
            LastEnd = e;
            Debug.Log($"[Fish] FISH_END {e.outcome} {e.reason} {e.defId} energy {e.energy}");
            ShowToast(e.outcome == FishOutcome.Missed ? (hookedEarly ? "Erken çektin: kıpırdama sahte, şamandıra batınca çek" : "Geç kaldın: şamandıra batınca hemen Space") : Describe(e));
            hookedEarly = false;
            if (keepsBobber) return;
            Reel = null;
            SetState(Phase.Idle);
            if (e.outcome == FishOutcome.Caught && BagOpen) RefreshBag();
        }

        public void OnPlayerEnter(PlayerEnterMsg e)
        {
            if (e.bobber == null || string.IsNullOrEmpty(e.bobber.band)) return;
            OnBobber(new BobberMsg { id = e.id, x = e.bobber.x, y = e.bobber.y, band = e.bobber.band, state = BobberState.Cast }, null);
        }

        public void RemoveBobber(string id)
        {
            if (!bobbers.TryGetValue(id, out var view)) return;
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
            bobbers.Remove(id);
        }

        public async void RefreshBag()
        {
            try
            {
                Bag = await net.GetInventoryAsync();
                Energy = Bag.energy;
                EnergyMax = Bag.energyMax;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Fish] get_inventory failed: {ex.Message}");
            }
        }

        void Reset(string why)
        {
            ShowToast(why);
            Reel = null;
            SetState(Phase.Idle);
        }

        void SetState(Phase s)
        {
            State = s;
            stateSince = Time.time;
        }

        void ShowToast(string text)
        {
            toast = text;
            toastUntil = Time.time + ToastSeconds;
        }

        static Vector2 DirVector(string facing)
        {
            switch (facing)
            {
                case Dir.Up: return Vector2.down; // server y grows down
                case Dir.Down: return Vector2.up;
                case Dir.Left: return Vector2.left;
                default: return Vector2.right;
            }
        }

        public static string ItemName(string defId)
        {
            if (string.IsNullOrEmpty(defId)) return "?";
            var dot = defId.LastIndexOf('.');
            return (dot >= 0 ? defId.Substring(dot + 1) : defId).Replace('_', ' ');
        }

        static string Describe(FishEndMsg e)
        {
            switch (e.outcome)
            {
                case FishOutcome.Caught:
                    if (e.item != null && !string.IsNullOrEmpty(e.item.instanceId))
                        return $"Yakaladın: {ItemName(e.item.defId)} ({e.item.tier}, Float {e.item.@float:0.0000})";
                    if (e.stack != null && !string.IsNullOrEmpty(e.stack.defId))
                        return $"Yakaladın: {ItemName(e.stack.defId)} (çantada {e.stack.count})";
                    return $"Yakaladın: {ItemName(e.defId)}";
                case FishOutcome.Escaped: return "Balık kaçtı";
                case FishOutcome.Missed: return "Kaçırdın: şamandıra batınca çek";
                case FishOutcome.Cancelled: return "Oltayı topladın";
                case FishOutcome.Rejected:
                    switch (e.reason)
                    {
                        case "BUSY": return "Zaten olta atılı";
                        case "NOT_NEAR_WATER": return "Suya daha yakın dur";
                        case "NOT_WATER": return "Oraya atılmaz, suya at";
                        case "TOO_FAR": return "Çok uzak";
                        case "BAG_FULL": return "Çanta dolu";
                        default: return $"Atış reddedildi ({e.reason})";
                    }
                default: return e.outcome;
            }
        }

        // ---------- UI ----------

        public void DrawGui(Vector2 me)
        {
            GUI.Label(new Rect(10, 30, 300, 24), $"Enerji: {Energy}/{EnergyMax}", Gui.Hud);

            var hint = Hint(me);
            if (hint != null) GUI.Label(new Rect(10, Gui.Height - 56, 700, 24), hint, State == Phase.Bite ? Gui.Alert : Gui.Hud);

            if (State == Phase.Charging)
            {
                var r = new Rect(Gui.Width / 2f - 100, Gui.Height - 110, 200, 14);
                GUI.Box(r, GUIContent.none);
                GUI.Box(new Rect(r.x, r.y, r.width * charge, r.height), GUIContent.none, Gui.Fill);
            }

            if (Reel != null && (State == Phase.Reeling || State == Phase.Judging)) DrawReel();

            if (toast != null && Time.time < toastUntil)
            {
                var size = Gui.Toast.CalcSize(new GUIContent(toast));
                GUI.Box(new Rect((Gui.Width - size.x) / 2f - 12, 60, size.x + 24, size.y + 12), toast, Gui.Toast);
            }

            if (BagOpen) DrawBag();
        }

        string Hint(Vector2 me)
        {
            switch (State)
            {
                case Phase.Idle:
                    return LakeMap.IsNearWater(me, NearWater) ? "F basılı tut, bırak: olta at · sağ tık: suya at · B: çanta" : null;
                case Phase.Charging: return "Bırakınca atar";
                case Phase.Waiting: return "Bekle… kıpırdama sahte, şamandıra batınca Space · Esc: topla";
                case Phase.Bite: return "ÇEK! (Space)";
                case Phase.Reeling: return "Space basılı tut: yeşil çubuğu balığın üstünde tut";
                default: return null;
            }
        }

        void DrawReel()
        {
            const float w = 40f, h = 300f;
            var x = Gui.Width - 120f;
            var y = Gui.Height / 2f - h / 2f;
            GUI.Box(new Rect(x - 6, y - 6, w + 40, h + 12), GUIContent.none);
            GUI.Box(new Rect(x, y, w, h), GUIContent.none, Gui.Water);

            float ToY(int v) => y + h - v / (float)ReelModel.Field * h;
            var p = Reel.Params;
            var barTop = ToY(Reel.Bar + p.barSize);
            GUI.Box(new Rect(x + 2, barTop, w - 4, ToY(Reel.Bar) - barTop), GUIContent.none, Gui.Fill);
            GUI.Box(new Rect(x + 8, ToY(Reel.Fish) - 5, w - 16, 10), GUIContent.none, Gui.FishMark);

            var progress = Mathf.Clamp01(Reel.Progress / (float)ReelModel.Field);
            GUI.Box(new Rect(x + w + 10, y, 14, h), GUIContent.none);
            GUI.Box(new Rect(x + w + 10, y + h * (1 - progress), 14, h * progress), GUIContent.none, Gui.Fill);
        }

        void DrawBag()
        {
            var r = new Rect(Gui.Width - 330, 60, 310, 360);
            GUILayout.BeginArea(r, GUI.skin.box);
            if (Bag == null)
            {
                GUILayout.Label("Çanta yükleniyor…", Gui.Hud);
            }
            else
            {
                GUILayout.Label($"Çanta {Bag.slotsUsed}/{Bag.slotsMax} · Enerji {Bag.energy}/{Bag.energyMax}", Gui.Hud);
                GUILayout.Space(6);
                if (Bag.items != null)
                    for (var i = Bag.items.Length - 1; i >= 0 && i >= Bag.items.Length - 10; i--)
                    {
                        var it = Bag.items[i];
                        GUILayout.Label($"{ItemName(it.defId)} · {it.tier} · Float {it.@float:0.0000}", Gui.Hud);
                    }
                if (Bag.stacks != null)
                    foreach (var s in Bag.stacks)
                        GUILayout.Label($"{ItemName(s.defId)} × {s.count}", Gui.Hud);
                if ((Bag.items == null || Bag.items.Length == 0) && (Bag.stacks == null || Bag.stacks.Length == 0))
                    GUILayout.Label("Boş", Gui.Hud);
            }
            GUILayout.FlexibleSpace();
            GUILayout.Label("B: kapat", Gui.Hud);
            GUILayout.EndArea();
        }
    }
}
