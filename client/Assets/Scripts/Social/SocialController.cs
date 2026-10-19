using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
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

        string addName = "";
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
            Key[] digits = { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4, Key.Digit5, Key.Digit6 };
            for (var i = 0; i < digits.Length; i++)
                if (k[digits[i]].wasPressedThisFrame) SendEmote(Emotes.All[i]);
        }

        public void SendEmote(string emote) => net.Send(OpCode.Emote, new EmoteMsg { emote = emote });

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

        // ---------- UI ----------

        public void DrawGui()
        {
            if (note != null && Time.time < noteUntil)
            {
                var size = Gui.Toast.CalcSize(new GUIContent(note)) + new Vector2(24f, 12f);
                GUI.Box(new Rect((Gui.Width - size.x) / 2f, Gui.Height - 150, size.x, size.y), note, Gui.Toast);
            }
            if (!FriendsOpen) return;

            var r = new Rect((Gui.Width - 420) / 2f, 60, 420, Mathf.Min(440, Gui.Height - 140));
            Gui.Block(r);
            GUILayout.BeginArea(r, Gui.Window);
            GUILayout.BeginHorizontal();
            GUILayout.Label("Arkadaşlar", Gui.Header);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Kapat", Gui.Button, GUILayout.Width(70)))
            {
                FriendsOpen = false;
                GUIUtility.keyboardControl = 0;
            }
            GUILayout.EndHorizontal();

            GUILayout.BeginHorizontal();
            addName = GUILayout.TextField(addName, 16, Gui.Input, GUILayout.Height(28));
            if (GUILayout.Button("Ekle", Gui.Button, GUILayout.Width(70), GUILayout.Height(28)) && addName.Trim().Length > 0)
            {
                AddFriend(null, addName.Trim());
                addName = "";
            }
            GUILayout.EndHorizontal();
            GUILayout.Space(6);

            if (Friends.Count == 0) GUILayout.Label("Henüz arkadaşın yok. Adını yaz ya da birinin profil kartından ekle.", Gui.Faint);
            foreach (var f in Friends.OrderBy(f => f.State).ThenBy(f => f.Username))
            {
                GUILayout.BeginHorizontal(GUI.skin.box);
                switch (f.State)
                {
                    case Connection.FriendMutual:
                        Status.TryGetValue(f.UserId, out var st);
                        var where = st == null || !st.online ? "çevrimdışı" : string.IsNullOrEmpty(st.serverName) ? "çevrimiçi" : st.serverName;
                        GUILayout.Label(f.Username, Gui.Hud, GUILayout.Width(150));
                        GUILayout.Label(where, st != null && st.online ? Gui.Hud : Gui.Faint);
                        GUILayout.FlexibleSpace();
                        GUI.enabled = st != null && st.online && !string.IsNullOrEmpty(st.matchId);
                        if (GUILayout.Button("Yanına git", Gui.Button, GUILayout.Width(100))) GotoFriend(st);
                        GUI.enabled = true;
                        break;
                    case Connection.FriendInviteReceived:
                        GUILayout.Label(f.Username, Gui.Hud, GUILayout.Width(150));
                        GUILayout.Label("seni eklemek istiyor", Gui.Faint);
                        GUILayout.FlexibleSpace();
                        if (GUILayout.Button("Kabul", Gui.Button, GUILayout.Width(70))) AddFriend(f.UserId, f.Username);
                        if (GUILayout.Button("Hayır", Gui.Button, GUILayout.Width(60))) Remove(f.UserId);
                        break;
                    case Connection.FriendInviteSent:
                        GUILayout.Label(f.Username, Gui.Hud, GUILayout.Width(150));
                        GUILayout.Label("cevap bekleniyor", Gui.Faint);
                        GUILayout.FlexibleSpace();
                        if (GUILayout.Button("İptal", Gui.Button, GUILayout.Width(60))) Remove(f.UserId);
                        break;
                    default:
                        GUILayout.Label(f.Username, Gui.Faint, GUILayout.Width(150));
                        GUILayout.Label("engelli", Gui.Faint);
                        break;
                }
                GUILayout.EndHorizontal();
            }
            GUILayout.FlexibleSpace();
            GUILayout.Label("Emote: 1 el salla · 2 alkış · 3 dans · 4 otur · 5 gül · 6 son avını göster", Gui.Faint);
            GUILayout.EndArea();
        }
    }
}
