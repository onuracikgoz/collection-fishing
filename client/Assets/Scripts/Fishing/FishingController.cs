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
    /// the reel bar. Esc reels in. B opens the bag. Y picks the special bait for
    /// the next casts (Faz 4), cycling through what is in the bag and back to basic bait.
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
        public int Level { get; private set; }
        /// <summary>XP inside the level, and what the level needs (0 at the top level).</summary>
        public int Xp { get; private set; }
        public int XpNext { get; private set; }
        public ReelModel Reel { get; private set; }
        public InventoryResponse Bag { get; private set; }
        /// <summary>Faz 4: our rod; max 0 until the server sent it.</summary>
        public RodView Rod { get; private set; }
        /// <summary>Faz 4: special bait for the next casts, null for basic bait.</summary>
        public string SelectedBait { get; set; }
        /// <summary>Called after every bag refresh (economy windows rebuild their lists).</summary>
        public Action BagChanged { get; set; }
        public bool BagOpen { get; set; }
        public string LastOutcome { get; private set; }
        public FishEndMsg LastEnd { get; private set; }
        /// <summary>Set by the autopilot to hold the reel instead of the keyboard.</summary>
        public Func<ReelModel, bool> BotReel { get; set; }

        /// <summary>No walking while the line is tight; walking while waiting reels in (server cancels).</summary>
        public bool BlocksMovement => State != Phase.Idle && State != Phase.Waiting;

        float charge;
        bool chargeByMouse;
        /// <summary>Cast power 0..1 while F is held (the meter of balik-at).</summary>
        public float Charge => charge;
        bool hookedEarly;
        Vector2? pendingCast;
        float stateSince;
        float reelStartedAt;
        bool reelPressed;

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
            Level = w.level;
            Xp = w.xp;
            XpNext = w.xpNext;
            if (w.rod != null && w.rod.max > 0) Rod = w.rod;
            RefreshBag(); // bait counts and balances for the HUD
        }

        public void SetRod(RodView rod)
        {
            if (rod != null && rod.max > 0) Rod = rod;
        }

        public bool RodBroken => Rod != null && Rod.max > 0 && Rod.durability <= 0;

        /// <summary>How many of a stack the bag holds, as of the last refresh.</summary>
        public int StackCount(string defId)
        {
            if (Bag?.stacks == null || string.IsNullOrEmpty(defId)) return 0;
            foreach (var st in Bag.stacks)
                if (st.defId == defId) return st.count;
            return 0;
        }

        /// <summary>Y: next special bait in the bag, then basic bait again.</summary>
        public void CycleBait()
        {
            var owned = new List<string>();
            if (Bag?.stacks != null)
                foreach (var st in Bag.stacks)
                    if (st.defId.StartsWith("bait.") && st.count > 0) owned.Add(st.defId);
            owned.Sort(StringComparer.Ordinal);
            if (owned.Count == 0)
            {
                SelectedBait = null;
                ShowToast("Çantanda özel yem yok (dükkandan alınır)");
                return;
            }
            var i = SelectedBait == null ? -1 : owned.IndexOf(SelectedBait);
            SelectedBait = i + 1 < owned.Count ? owned[i + 1] : null;
            ShowToast(SelectedBait == null ? "Temel yem" : $"Yem: {ItemName(SelectedBait)} (çantada {StackCount(SelectedBait)})");
        }

        // ---------- input ----------

        /// <summary>
        /// F and the right mouse button do the same: hold to charge, let go to cast (F toward the
        /// facing, the mouse toward the pointer), press to hook, hold to reel. Space also hooks and reels.
        /// <paramref name="worldBlocked"/> (a window is open) stops a new cast; the hotkeys still work.
        /// </summary>
        /// <summary>This frame's right click opened a player's menu (WorldController): it does not cast or hook.</summary>
        public bool RightClickTaken { get; set; }

        public void Update(Vector2 me, string facing, bool chatOpen, bool worldBlocked, Camera cam)
        {
            var now = Time.time;
            var k = Keyboard.current;
            var mouse = Mouse.current;
            var typing = chatOpen || k == null;
            var rightDown = mouse != null && mouse.rightButton.wasPressedThisFrame && !UiRoot.PointerOverUi && !RightClickTaken;
            RightClickTaken = false;
            var rightHeld = mouse != null && mouse.rightButton.isPressed;

            if (!typing && k.bKey.wasPressedThisFrame)
            {
                BagOpen = !BagOpen;
                if (BagOpen) RefreshBag();
            }
            if (!typing && k.yKey.wasPressedThisFrame && State == Phase.Idle) CycleBait();

            switch (State)
            {
                case Phase.Idle:
                    if (typing || worldBlocked) break;
                    if (k.fKey.wasPressedThisFrame || (rightDown && cam != null))
                    {
                        charge = 0f;
                        chargeByMouse = !k.fKey.wasPressedThisFrame;
                        SetState(Phase.Charging);
                    }
                    break;

                case Phase.Charging:
                    charge = Mathf.Min(1f, charge + Time.deltaTime / ChargeSeconds);
                    var held = chargeByMouse ? rightHeld : !typing && k.fKey.isPressed;
                    if (!held)
                    {
                        var dir = DirVector(facing);
                        if (chargeByMouse && cam != null)
                        {
                            var screen = mouse.position.ReadValue();
                            var world = Coords.ToServer(cam.ScreenToWorldPoint(new Vector3(screen.x, screen.y, -cam.transform.position.z)));
                            if ((world - me).sqrMagnitude > 0.01f) dir = (world - me).normalized;
                        }
                        Cast(me + dir * Mathf.Lerp(MinCast, MaxCast, charge));
                    }
                    break;

                case Phase.Casting:
                    // A MOVE still on its way would count as walking and cancel the cast,
                    // so the CAST waits until the server has our final position.
                    if (pendingCast.HasValue && movementSynced())
                    {
                        var p = pendingCast.Value;
                        // Out of the chosen bait: fall back to basic bait instead of a NO_BAIT refusal.
                        if (SelectedBait != null && StackCount(SelectedBait) <= 0) SelectedBait = null;
                        if (SelectedBait != null) net.Send(OpCode.Cast, new CastBaitMsg { x = p.x, y = p.y, bait = SelectedBait });
                        else net.Send(OpCode.Cast, new CastMsg { x = p.x, y = p.y });
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
                    if (k.spaceKey.wasPressedThisFrame || k.fKey.wasPressedThisFrame || rightDown) Hook();
                    else if (k.escapeKey.wasPressedThisFrame)
                    {
                        net.Send(OpCode.Cancel, new EmptyMsg());
                    }
                    break;

                case Phase.Reeling:
                    StepReel(rightHeld || (!typing && (k.spaceKey.isPressed || k.fKey.isPressed || (mouse != null && mouse.leftButton.isPressed))));
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
            Debug.Log($"[Fish] BOBBER {b.state} {b.band} ({b.x:0.0}, {b.y:0.0}){(b.state == BobberState.Cast ? $" energy {b.energy}" : "")}");
            if (b.state == BobberState.Bite && (State == Phase.Waiting || State == Phase.Casting)) SetState(Phase.Bite);
            else if (b.state == BobberState.Cast && State == Phase.Casting) SetState(Phase.Waiting);
            if (b.state == BobberState.Cast) Energy = b.energy;
            if (b.state == BobberState.Cast && b.bait != null && !string.IsNullOrEmpty(b.bait.defId)) SetStack(b.bait.defId, b.bait.count);
        }

        /// <summary>Keeps the cached bag in step with a stack total the server just sent.</summary>
        public void SetStack(string defId, int count)
        {
            if (Bag == null || string.IsNullOrEmpty(defId)) return;
            var list = new List<ItemStack>(Bag.stacks ?? Array.Empty<ItemStack>());
            var i = list.FindIndex(st => st.defId == defId);
            if (count <= 0) { if (i >= 0) list.RemoveAt(i); }
            else if (i >= 0) list[i].count = count;
            else list.Add(new ItemStack { defId = defId, count = count });
            Bag.stacks = list.ToArray();
            if (SelectedBait == defId && count <= 0) SelectedBait = null;
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
            SetRod(e.rod);
            if (e.xpGain != null && e.xpGain.level > 0)
            {
                Level = e.xpGain.level;
                Xp = e.xpGain.xp;
                XpNext = e.xpGain.xpNext;
                if (e.xpGain.levelUp != null && e.xpGain.levelUp.level > 0) Toasts.LevelUp(e.xpGain.levelUp.level, e.xpGain.levelUp.unlocks);
            }
            LastOutcome = e.outcome;
            LastEnd = e;
            Debug.Log($"[Fish] FISH_END {e.outcome} {e.reason} {e.defId} energy {e.energy}");
            ShowToast(e.outcome == FishOutcome.Missed ? (hookedEarly ? "Erken çektin: kıpırdama sahte, şamandıra batınca çek" : "Geç kaldın: şamandıra batınca hemen Space") : Describe(e));
            Warnings(e);
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
                EnergyMax = Bag.energyMax;
                SetRod(Bag.rod);
                if (SelectedBait != null && StackCount(SelectedBait) <= 0) SelectedBait = null;
                BagChanged?.Invoke();
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

        void ShowToast(string text) => Toasts.Show(text);

        // Client-state warnings of bildirim-yigin, once when crossing (display thresholds only).
        bool energyWarned, rodWarned;

        void Warnings(FishEndMsg e)
        {
            if (e.outcome == FishOutcome.Rejected && e.reason == "BAG_FULL")
                Toasts.Notify($"Çanta dolu {Bag?.slotsUsed}/{Bag?.slotsMax}", "Av yapılamaz. Sat veya parçala.", Toasts.Kind.Block);
            var lowEnergy = EnergyMax > 0 && Energy <= EnergyMax / 10;
            if (lowEnergy && !energyWarned) Toasts.Notify($"Enerji azaldı: {Energy}/{EnergyMax}", "Bitince sadece çöp çıkar.", Toasts.Kind.Warn);
            energyWarned = lowEnergy;
            var lowRod = Rod != null && Rod.max > 0 && Rod.durability * 100 / Rod.max <= 15;
            if (lowRod && !rodWarned) Toasts.Notify($"Olta yıpranıyor: %{Rod.durability * 100 / Rod.max}", "Tüccar'da (Dükkan) tamir et.", Toasts.Kind.Warn);
            rodWarned = lowRod;
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
                        case "NO_BAIT": return "Bu yemden kalmadı";
                        case "NO_ENERGY": return "Enerjin yok: özel yem boşa gitmesin diye atılmadı";
                        case "ROD_BROKEN": return "Olta kırık: özel yemle atılmaz, önce tamir et";
                        default: return $"Atış reddedildi ({e.reason})";
                    }
                default: return e.outcome;
            }
        }

        // ---------- UI ----------

        public void DrawGui(Vector2 me)
        {
            // Energy, rod and bait are on the uGUI HUD (World/WorldHud.cs); the hint, the cast meter,
            // the bite mark and the reel are drawn next to the player by World/FishingHud.cs.


        }

        public string Hint(Vector2 me)
        {
            switch (State)
            {
                case Phase.Idle:
                    return LakeMap.IsNearWater(me, NearWater) ? "F ya da sağ tık basılı tut, bırak: olta at · Y: yem · B: çanta" : null;
                case Phase.Charging: return "Bırakınca atar";
                case Phase.Waiting: return "Bekle... kıpırdama sahte, şamandıra batınca F / sağ tık · Esc: topla";
                case Phase.Bite: return "ÇEK! (F / sağ tık)";
                case Phase.Reeling: return "F / sağ tık basılı tut: yeşil çubuğu balığın üstünde tut";
                default: return null;
            }
        }

    }
}
