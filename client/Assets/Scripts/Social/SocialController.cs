using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine.UI;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.Social
{
    /// <summary>
    /// Phase 3 social features on the client (docs/protokol.md, Arkadaşlar, ışınlanma,
    /// emote; docs/tasarim/10-sosyal.md 13.2): the friends window (Nakama friend API +
    /// friends_status), "Yanına git" (GOTO_FRIEND, or rejoining another server near the
    /// friend) and emotes on keys 1-6. Placeholder UI.
    /// </summary>
    public sealed class SocialController
    {
        const float RefreshSeconds = 5f;
        const float EmoteSeconds = 3f;

        readonly Connection net;
        /// <summary>Joins another server beside a friend: (matchId, serverName, friendUserId).</summary>
        readonly Action<string, string, string> switchServer;

        public bool FriendsOpen { get; set; }
        public List<Connection.Friend> Friends { get; private set; } = new List<Connection.Friend>();
        public Dictionary<string, FriendStatus> Status { get; } = new Dictionary<string, FriendStatus>();
        public TeleportMsg LastTeleport { get; private set; }
        public int EmotesSeen { get; private set; }

        float nextRefresh;
        string note;
        float noteUntil;
        bool refreshing;

        public SocialController(Connection net, Action<string, string, string> switchServer)
        {
            this.net = net;
            this.switchServer = switchServer;
        }

        public static string EmoteText(string emote, string defId)
        {
            switch (emote)
            {
                case Emotes.Wave: return "el sallıyor";
                case Emotes.Clap: return "alkışlıyor";
                case Emotes.Dance: return "dans ediyor";
                case Emotes.Sit: return "oturdu";
                case Emotes.Laugh: return "gülüyor";
                case Emotes.ShowFish: return $"{FishingController.ItemName(defId)} gösteriyor";
                default: return emote;
            }
        }

        // ---------- input ----------

        public void Update(bool chatOpen)
        {
            if (FriendsOpen && Time.time >= nextRefresh) Refresh();
            var k = Keyboard.current;
            if (chatOpen || k == null) return;
            if (k.oKey.wasPressedThisFrame)
            {
                FriendsOpen = !FriendsOpen;
                if (FriendsOpen) Refresh();
                else GUIUtility.keyboardControl = 0;
            }
            if (k.tKey.wasPressedThisFrame) EmoteMenuOpen = !EmoteMenuOpen;
            Key[] digits = { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4, Key.Digit5, Key.Digit6 };
            for (var i = 0; i < digits.Length; i++)
                if (k[digits[i]].wasPressedThisFrame) SendEmote(Emotes.All[i]);
        }

        public void SendEmote(string emote) => net.Send(OpCode.Emote, new EmoteMsg { emote = emote });

        // ---------- status emotes (draft emote-menu; protokol.md, Durum emote'u) ----------

        /// <summary>The free status emotes of the server's EMOTES.status list; the others show once owned (WELCOME.emotesOwned).</summary>
        static readonly string[] FreeStatus = { "smile", "laugh", "zzz", "fish", "ask", "heart", "note", "coffee" };

        public bool EmoteMenuOpen { get; set; }
        public string MyStatus { get; private set; }
        string[] owned = Array.Empty<string>();
        /// <summary>Status emote worn by each player in view (and me).</summary>
        public Dictionary<string, string> StatusOf { get; } = new Dictionary<string, string>();
        EmoteView emoteView;
        bool emoteDirty = true;

        public static string StatusName(string id)
        {
            switch (id)
            {
                case "smile": return "Gülümse";
                case "laugh": return "Kahkaha";
                case "zzz": return "Uykulu";
                case "fish": return "Balık";
                case "ask": return "Soru";
                case "heart": return "Kalp";
                case "note": return "Müzik";
                case "coffee": return "Kahve";
                case "star": return "Yıldız";
                case "cool": return "Havalı";
                case "crown": return "Taç";
                case "sparkle": return "Parıltı";
                case "fire": return "Ateş";
                case "rain": return "Yağmur";
                case "comet": return "Kuyrukluyıldız";
                case "goldfish": return "Altın balık";
                default: return id;
            }
        }

        static string GestureName(string id) =>
            id == Emotes.Wave ? "el salla" : id == Emotes.Clap ? "alkış" : id == Emotes.Dance ? "dans" : id == Emotes.Sit ? "otur"
            : id == Emotes.Laugh ? "gül" : id == Emotes.ShowFish ? "avı göster" : id;

        public void OnWelcome(WelcomeMsg w, string myId)
        {
            MyStatus = string.IsNullOrEmpty(w.status) ? null : w.status;
            owned = w.emotesOwned ?? Array.Empty<string>();
            StatusOf[myId] = MyStatus;
            emoteDirty = true;
        }

        public void OnPlayerEnter(PlayerEnterMsg e) => StatusOf[e.id] = string.IsNullOrEmpty(e.status) ? null : e.status;

        public void OnStatus(EmoteStatusShowMsg m, string myId)
        {
            var emote = string.IsNullOrEmpty(m.emote) ? null : m.emote;
            StatusOf[m.id] = emote;
            if (m.id != myId) return;
            MyStatus = emote;
            emoteDirty = true;
            if (!string.IsNullOrEmpty(m.reason))
                UI.Toasts.Show(m.reason == "NOT_OWNED" ? "Bu emote sende yok" : m.reason == "RATE_LIMITED" ? "Biraz bekle" : $"Takılamadı ({m.reason})", true);
        }

        void Wear(string emote) => net.Send(OpCode.EmoteStatus, new EmoteStatusMsg { emote = emote ?? "" });

        public void TickEmotes()
        {
            if (emoteView == null)
            {
                emoteView = UI.UiRoot.Get().Spawn<EmoteView>("Emote");
                if (emoteView == null) return;
                emoteView.window.Closed = () => EmoteMenuOpen = false;
                emoteView.window.Open = false;
                emoteView.remove.onClick.AddListener(() => Wear(null));
                foreach (var slot in emoteView.status) slot.Clicked = s => { if (s.Data is string id) Wear(id); };
                for (var i = 0; i < emoteView.gestures.Length; i++)
                {
                    var g = i < Emotes.All.Length ? Emotes.All[i] : null;
                    var slot = emoteView.gestures[i];
                    slot.gameObject.SetActive(g != null);
                    if (g == null) continue;
                    slot.SetEmpty();
                    slot.label.text = GestureName(g);
                    slot.Clicked = _ => SendEmote(g);
                }
            }
            if (emoteView.window.Open != EmoteMenuOpen)
            {
                emoteView.window.Open = EmoteMenuOpen;
                emoteDirty = true;
            }
            if (!EmoteMenuOpen || !emoteDirty) return;
            emoteDirty = false;
            var v = emoteView;
            v.current.SetEmpty();
            v.current.label.text = MyStatus != null ? StatusName(MyStatus) : "";
            v.currentText.text = MyStatus != null
                ? $"Üstünde duruyor: {StatusName(MyStatus)}\n<color=#7f708a>Seçilince karakterinin üstünde kalır.</color>"
                : "Üstünde emote yok\n<color=#7f708a>Aşağıdan birine tıkla, karakterinin üstünde kalır.</color>";
            v.remove.interactable = MyStatus != null;
            var list = FreeStatus.Concat(owned.Where(o => !FreeStatus.Contains(o))).ToList();
            for (var i = 0; i < v.status.Length; i++)
            {
                var slot = v.status[i];
                var id = i < list.Count ? list[i] : null;
                slot.gameObject.SetActive(id != null || i < 8);
                if (id == null)
                {
                    slot.SetEmpty();
                    slot.Data = null;
                    continue;
                }
                slot.SetItem("x." + id, "", 1, false, id == MyStatus);
                slot.label.text = StatusName(id);
                slot.Data = id;
            }
        }

        public void DestroyEmotes()
        {
            if (emoteView != null) UnityEngine.Object.Destroy(emoteView.gameObject);
        }

        public void GotoFriend(FriendStatus f)
        {
            if (!f.online || string.IsNullOrEmpty(f.matchId))
            {
                ShowNote($"{f.username} şu an oyunda değil");
                return;
            }
            if (f.matchId == net.MatchId) net.Send(OpCode.GotoFriend, new GotoFriendMsg { userId = f.userId });
            else switchServer(f.matchId, f.serverName, f.userId);
        }

        // ---------- server ----------

        public void OnTeleport(TeleportMsg t)
        {
            LastTeleport = t;
            Debug.Log($"[Social] TELEPORT ({t.x:0.0}, {t.y:0.0}) {t.reason}");
            if (string.IsNullOrEmpty(t.reason)) return;
            ShowNote(t.reason == "RATE_LIMITED" ? "Biraz bekle, sonra tekrar dene"
                : t.reason == "NOT_HERE" ? "Arkadaşın bu sunucuda değil"
                : t.reason == "NO_SPOT" ? "Yanında boş yer yok"
                : t.reason == "NOT_FRIEND" ? "Sadece karşılıklı arkadaşının yanına gidebilirsin"
                : t.reason == "BUSY" ? "Takastayken ışınlanamazsın"
                : t.reason);
        }

        public void OnEmote(EmoteShowMsg e, World.CharacterView who)
        {
            EmotesSeen++;
            Debug.Log($"[Social] EMOTE_SHOW {e.id} {e.emote} {e.defId}");
            who?.ShowEmote(e.emote, EmoteText(e.emote, e.defId), EmoteSeconds);
        }

        // ---------- RPCs ----------

        public async void Refresh()
        {
            if (refreshing) return;
            refreshing = true;
            nextRefresh = Time.time + RefreshSeconds;
            try
            {
                Friends = await net.ListFriendsAsync();
                var status = await net.FriendsStatusAsync();
                Status.Clear();
                foreach (var f in status.friends ?? Array.Empty<FriendStatus>()) Status[f.userId] = f;
                dirty = true;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Social] friends refresh failed: {ex.Message}");
            }
            refreshing = false;
        }

        public async void AddFriend(string userId, string username)
        {
            try
            {
                await net.AddFriendAsync(userId, username);
                ShowNote($"Arkadaşlık isteği: {username ?? "gönderildi"}");
                Refresh();
            }
            catch (Exception ex)
            {
                ShowNote("Oyuncu bulunamadı");
                Debug.LogWarning($"[Social] add friend failed: {ex.Message}");
            }
        }

        async void Remove(string userId)
        {
            try
            {
                await net.RemoveFriendAsync(userId);
                Refresh();
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Social] remove friend failed: {ex.Message}");
            }
        }

        void ShowNote(string text)
        {
            note = text;
            noteUntil = Time.time + 4f;
        }

        // ---------- UI (uGUI: Resources/UI/Friends, drafts arkadaslar-list / -requests) ----------

        public enum FriendsTab { Friends, Requests, Blocked }

        static readonly Color Ink = new Color32(0x45, 0x29, 0x3f, 255);
        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);
        static readonly Color Paper = new Color32(0xf2, 0xe8, 0xd0, 255);

        FriendsView view;
        readonly List<GameObject> rows = new List<GameObject>();
        FriendsTab tab;
        bool dirty = true;

        public PopupView Popup { get; set; }
        /// <summary>Opening a whisper, a profile card, a book; blocking. Set by the world.</summary>
        public Action<string, string> Whisper { get; set; }
        public Action<string> OpenProfile { get; set; }
        public Action<string, string> OpenBook { get; set; }
        /// <summary>"Sadece arkadaşlardan mesaj al" is the server's PM off setting (Ayarlar has it too).</summary>
        public Func<bool> PmOff { get; set; }
        public Action<bool> SetPmOff { get; set; }

        public void Destroy()
        {
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
        }

        FriendsView View
        {
            get
            {
                if (view != null) return view;
                view = UI.UiRoot.Get().Spawn<FriendsView>("Friends");
                if (view == null) return null;
                view.window.Closed = () => FriendsOpen = false;
                view.window.Open = false;
                for (var i = 0; i < view.tabs.Length; i++)
                {
                    var t = (FriendsTab)i;
                    view.tabs[i].button.onClick.AddListener(() =>
                    {
                        tab = t;
                        dirty = true;
                    });
                }
                view.add.onClick.AddListener(AddTyped);
                view.search.onEndEdit.AddListener(_ =>
                {
                    var k = Keyboard.current;
                    if (k != null && (k.enterKey.wasPressedThisFrame || k.numpadEnterKey.wasPressedThisFrame)) AddTyped();
                });
                view.friendsOnly.onValueChanged.AddListener(x =>
                {
                    if (PmOff != null && x != PmOff()) SetPmOff?.Invoke(x);
                });
                return view;
            }
        }

        void AddTyped()
        {
            var name = view.search.text.Trim();
            if (name.Length == 0) return;
            view.search.text = "";
            AddFriend(null, name);
        }

        /// <summary>Call every frame.</summary>
        public void Tick()
        {
            var v = View;
            if (v == null) return;
            if (v.window.Open != FriendsOpen)
            {
                v.window.Open = FriendsOpen;
                dirty = true;
            }
            if (!FriendsOpen) return;
            if (PmOff != null && v.friendsOnly.isOn != PmOff()) v.friendsOnly.SetIsOnWithoutNotify(PmOff());
            if (dirty && !v.search.isFocused) Redraw(v);
        }

        void Redraw(FriendsView v)
        {
            dirty = false;
            foreach (var r in rows) UnityEngine.Object.Destroy(r);
            rows.Clear();
            var mutual = Friends.Where(f => f.State == Connection.FriendMutual).ToList();
            var incoming = Friends.Where(f => f.State == Connection.FriendInviteReceived).ToList();
            var sent = Friends.Where(f => f.State == Connection.FriendInviteSent).ToList();
            var blocked = Friends.Where(f => f.State == Connection.FriendBlocked).ToList();
            v.tabs[0].label.text = $"Arkadaşlar {mutual.Count}";
            v.requestBadge.SetActive(incoming.Count > 0);
            v.requestCount.text = incoming.Count.ToString();
            for (var i = 0; i < v.tabs.Length; i++) v.tabs[i].Set(i == (int)tab);
            v.empty.text = "";
            switch (tab)
            {
                case FriendsTab.Friends:
                    var online = mutual.Where(f => Status.TryGetValue(f.UserId, out var st) && st.online).OrderBy(f => f.Username).ToList();
                    var offline = mutual.Except(online).OrderBy(f => f.Username).ToList();
                    if (mutual.Count == 0) v.empty.text = "Henüz arkadaşın yok. Adını yaz ya da birinin kartından ekle.";
                    if (online.Count > 0) Section(v, $"Çevrimiçi · {online.Count}");
                    foreach (var f in online) FriendLine(v, f, true);
                    if (offline.Count > 0) Section(v, $"Çevrimdışı · {offline.Count}");
                    foreach (var f in offline) FriendLine(v, f, false);
                    break;
                case FriendsTab.Requests:
                    if (incoming.Count + sent.Count == 0) v.empty.text = "Bekleyen istek yok.";
                    if (incoming.Count > 0) Section(v, $"Gelen istekler · {incoming.Count}");
                    foreach (var f in incoming)
                    {
                        var r = Row(v, f, IsOnline(f));
                        r.sub.text = IsOnline(f) ? Where(f) : "çevrimdışı";
                        Show(r.no, () => Remove(f.UserId));
                        Show(r.yes, () => AddFriend(f.UserId, f.Username));
                    }
                    if (sent.Count > 0) Section(v, $"Gönderdiğin · {sent.Count}");
                    foreach (var f in sent)
                    {
                        var r = Row(v, f, IsOnline(f));
                        r.sub.text = "cevap bekleniyor";
                        Show(r.cancel, () => Remove(f.UserId));
                    }
                    break;
                default:
                    if (blocked.Count == 0) v.empty.text = "Engellediğin kimse yok.";
                    foreach (var f in blocked)
                    {
                        var r = Row(v, f, false);
                        r.sub.text = "engelli: sana yazamaz, takas teklif edemez";
                        Show(r.unblock, () => Remove(f.UserId));
                    }
                    break;
            }
        }

        bool IsOnline(Connection.Friend f) => Status.TryGetValue(f.UserId, out var st) && st.online;

        string Where(Connection.Friend f) =>
            Status.TryGetValue(f.UserId, out var st) && st.online ? string.IsNullOrEmpty(st.serverName) ? "çevrimiçi" : st.serverName : "çevrimdışı";

        void Section(FriendsView v, string text)
        {
            var t = UnityEngine.Object.Instantiate(v.sectionTemplate, v.list, false);
            t.gameObject.SetActive(true);
            t.text = text;
            rows.Add(t.gameObject);
        }

        FriendRow Row(FriendsView v, Connection.Friend f, bool online)
        {
            var r = UnityEngine.Object.Instantiate(v.rowTemplate, v.list, false);
            r.gameObject.SetActive(true);
            r.back.enabled = online;
            r.avatar.SetEmpty();
            r.avatar.label.text = f.Username.Length > 0 ? f.Username.Substring(0, 1).ToUpperInvariant() : "?";
            r.dot.sprite = online ? v.dotOnline : v.dotOffline;
            r.player.text = f.Username;
            r.player.color = online ? Ink : Faint;
            foreach (var b in new[] { r.go, r.chat, r.menu, r.no, r.yes, r.cancel, r.unblock }) b.gameObject.SetActive(false);
            rows.Add(r.gameObject);
            return r;
        }

        static void Show(Button b, Action a)
        {
            b.gameObject.SetActive(true);
            b.onClick.AddListener(() => a());
        }

        void FriendLine(FriendsView v, Connection.Friend f, bool online)
        {
            var r = Row(v, f, online);
            r.sub.text = Where(f);
            if (online && Status.TryGetValue(f.UserId, out var st) && !string.IsNullOrEmpty(st.matchId)) Show(r.go, () => GotoFriend(st));
            Show(r.chat, () => Whisper?.Invoke(f.UserId, f.Username));
            Show(r.menu, () => Popup?.ShowMenu(f.Username, new (string, Action)[]
            {
                ("Profil kartı", () => OpenProfile?.Invoke(f.UserId)),
                ("Defterine bak", () => OpenBook?.Invoke(f.UserId, f.Username)),
                ("Arkadaşlıktan çık", () => Remove(f.UserId)),
                ("Engelle", () => Block(f.UserId, f.Username)),
            }));
        }

        async void Block(string userId, string name)
        {
            try
            {
                await net.BlockAsync(userId);
                UI.Toasts.Show($"{name} engellendi");
                Refresh();
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Social] block failed: {ex.Message}");
                UI.Toasts.Show("Engellenemedi", true);
            }
        }

        /// <summary>The short note (teleport refusals, friend requests) as a toast.</summary>
        public void DrawGui()
        {
            if (note != null && Time.time < noteUntil)
            {
                UI.Toasts.Show(note);
                note = null;
            }
        }
    }
}
