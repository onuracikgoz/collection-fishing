using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using Nakama;
using UnityEngine;

namespace CollectionGame.Net
{
    /// <summary>
    /// One player's link to Nakama: device login, RPCs and the world match socket.
    /// Incoming match messages are queued; the world drains them in its Update,
    /// so nothing is lost while the scene is still being set up (WELCOME arrives
    /// before JoinMatchAsync returns).
    /// </summary>
    public sealed class Connection
    {
        public const int Port = 7350;
        const string ServerKey = "defaultkey";

        public readonly struct Incoming
        {
            public readonly long Op;
            public readonly string Json;
            public Incoming(long op, string json) { Op = op; Json = json; }
        }

        /// <summary>A live Nakama notification (whisper, stall sale...), drained by the world like match messages.</summary>
        public readonly struct Notice
        {
            public readonly int Code;
            public readonly string Subject, Json, SenderId;
            public Notice(int code, string subject, string json, string senderId) { Code = code; Subject = subject; Json = json; SenderId = senderId; }
        }

        readonly IClient client;
        readonly Queue<Incoming> inbox = new Queue<Incoming>();
        readonly Queue<Notice> notices = new Queue<Notice>();
        ISocket socket;

        public ISession Session { get; private set; }
        public string MatchId { get; private set; }
        public string UserId => Session?.UserId;
        public string Username => Session?.Username;
        /// <summary>Set when the socket drops; the world shows it and returns to login.</summary>
        public string ClosedReason { get; private set; }

        public Connection(string host)
        {
            // A web build served over https may only talk to Nakama over https / wss.
            var scheme = Application.absoluteURL != null && Application.absoluteURL.StartsWith("https:") ? "https" : "http";
            client = new Client(scheme, host, Port, ServerKey, UnityWebRequestAdapter.Instance);
        }

        /// <summary>Server address to suggest: the web page's own host in a web build, else this machine.</summary>
        public static string DefaultHost()
        {
            if (Application.platform == RuntimePlatform.WebGLPlayer && Uri.TryCreate(Application.absoluteURL, UriKind.Absolute, out var page) && !string.IsNullOrEmpty(page.Host))
                return page.Host;
            return "127.0.0.1";
        }

        /// <summary>Device login with the username (sent every time; ignored by Nakama once the account exists).</summary>
        public async Task LoginAsync(string username)
        {
            Session = await client.AuthenticateDeviceAsync(DeviceIds.For(username), username, create: true);
            var rpc = await client.RpcAsync(Session, "healthcheck", "{}");
            var health = JsonUtility.FromJson<HealthcheckResponse>(rpc.Payload);
            if (health == null || health.protocolVersion != Protocol.Version)
                throw new Exception($"{ErrorCode.ProtocolMismatch}: server {health?.protocolVersion}, client {Protocol.Version}");
        }

        public async Task<ServerInfo[]> ListServersAsync()
        {
            var rpc = await client.RpcAsync(Session, "list_servers", "{}");
            return JsonUtility.FromJson<ListServersResponse>(rpc.Payload)?.servers ?? Array.Empty<ServerInfo>();
        }

        public async Task<InventoryResponse> GetInventoryAsync()
        {
            var rpc = await client.RpcAsync(Session, "get_inventory", "{}");
            return JsonUtility.FromJson<InventoryResponse>(rpc.Payload);
        }

        /// <summary>Faz 4 prices, recipes, baits and stash tiers. Display only; the server decides every result.</summary>
        public async Task<CatalogResponse> GetCatalogAsync()
        {
            var rpc = await client.RpcAsync(Session, "get_catalog", "{}");
            return JsonUtility.FromJson<CatalogResponse>(rpc.Payload);
        }

        /// <summary>Names, sets and image hashes of every item (admin panel content).</summary>
        public async Task<ContentResponse> GetContentAsync()
        {
            var rpc = await client.RpcAsync(Session, "get_content", "{}");
            return JsonUtility.FromJson<ContentResponse>(rpc.Payload);
        }

        /// <summary>Images (128x128 PNG, base64) of up to 40 items.</summary>
        public async Task<ItemArtResponse> GetItemArtAsync(string[] ids)
        {
            var rpc = await client.RpcAsync(Session, "get_item_art", JsonUtility.ToJson(new ItemArtRequest { ids = ids }));
            return JsonUtility.FromJson<ItemArtResponse>(rpc.Payload);
        }

        public async Task<BookResponse> GetBookAsync(string userId = null)
        {
            var rpc = await client.RpcAsync(Session, "get_book", UserArg(userId));
            return JsonUtility.FromJson<BookResponse>(rpc.Payload);
        }

        public async Task<ProfileResponse> GetProfileAsync(string userId = null)
        {
            var rpc = await client.RpcAsync(Session, "get_profile", UserArg(userId));
            return JsonUtility.FromJson<ProfileResponse>(rpc.Payload);
        }

        /// <summary>
        /// set_profile. Fields left null are kept; <paramref name="clearHunting"/> sends
        /// hunting: null. Written by hand because JsonUtility cannot omit or null a field.
        /// </summary>
        public async Task<ProfileResponse> SetProfileAsync(string[] showcase = null, string hunting = null, bool clearHunting = false)
        {
            var parts = new List<string>();
            if (showcase != null)
            {
                var ids = new List<string>();
                foreach (var id in showcase) ids.Add(JsonString(id));
                parts.Add($"\"showcase\":[{string.Join(",", ids)}]");
            }
            if (clearHunting) parts.Add("\"hunting\":null");
            else if (hunting != null) parts.Add($"\"hunting\":{JsonString(hunting)}");
            var rpc = await client.RpcAsync(Session, "set_profile", "{" + string.Join(",", parts) + "}");
            return JsonUtility.FromJson<ProfileResponse>(rpc.Payload);
        }

        /// <summary>Calls an RPC with a JsonUtility body and parses the answer. Errors throw; see <see cref="ErrorOf"/>.</summary>
        public async Task<T> RpcAsync<T>(string id, object body)
        {
            var rpc = await client.RpcAsync(Session, id, body == null ? "{}" : JsonUtility.ToJson(body));
            return JsonUtility.FromJson<T>(string.IsNullOrEmpty(rpc.Payload) ? "{}" : rpc.Payload);
        }

        /// <summary>Calls an RPC with a ready JSON body and returns the raw answer (for answers JsonUtility cannot read).</summary>
        public async Task<string> RpcRawAsync(string id, string json)
        {
            var rpc = await client.RpcAsync(Session, id, string.IsNullOrEmpty(json) ? "{}" : json);
            return rpc.Payload;
        }

        /// <summary>whisper_send. Unity sends empty fields as "", which the server skips.</summary>
        public Task<WhisperSendResponse> WhisperAsync(string userId, string username, string text, string context = null) =>
            RpcAsync<WhisperSendResponse>("whisper_send", new WhisperSendRequest { userId = userId ?? "", username = username ?? "", text = text, context = context ?? "" });

        /// <summary>whisper_settings: null only reads.</summary>
        public async Task<bool> WhisperSettingsAsync(bool? pmOff)
        {
            var body = pmOff.HasValue ? "{\"pmOff\":" + (pmOff.Value ? "true" : "false") + "}" : "{}";
            var rpc = await client.RpcAsync(Session, "whisper_settings", body);
            return JsonUtility.FromJson<WhisperSettings>(rpc.Payload)?.pmOff ?? false;
        }

        public Task ReportAsync(string userId, string reason, string note, string text) =>
            RpcAsync<WhisperSettings>("report_player", new ReportPlayerRequest { userId = userId, reason = reason, note = note ?? "", text = text ?? "" });

        /// <summary>Which login ways this account has (Ayarlar > Hesap): Nakama's own account call.</summary>
        public readonly struct Logins
        {
            public readonly bool Device, Google, Facebook, Steam, Custom;
            public readonly string Email;
            public Logins(bool device, bool google, bool facebook, bool steam, bool custom, string email)
            {
                Device = device; Google = google; Facebook = facebook; Steam = steam; Custom = custom; Email = email;
            }
        }

        public async Task<Logins> GetLoginsAsync()
        {
            var a = await client.GetAccountAsync(Session);
            var u = a.User;
            var devices = a.Devices != null && a.Devices.GetEnumerator().MoveNext();
            return new Logins(devices, !string.IsNullOrEmpty(u.GoogleId), !string.IsNullOrEmpty(u.FacebookId),
                !string.IsNullOrEmpty(u.SteamId), !string.IsNullOrEmpty(a.CustomId), a.Email);
        }

        public Task BlockAsync(string userId) => client.BlockFriendsAsync(Session, new[] { userId });

        /// <summary>
        /// The game error code inside an RPC failure (the server sends {"code","message"} as the
        /// message), or null.
        /// </summary>
        public static string ErrorOf(Exception e)
        {
            var msg = e?.GetBaseException().Message ?? "";
            var at = msg.IndexOf("\"code\"", StringComparison.Ordinal);
            if (at >= 0)
            {
                var start = msg.IndexOf('"', msg.IndexOf(':', at) + 1);
                var end = start >= 0 ? msg.IndexOf('"', start + 1) : -1;
                if (start >= 0 && end > start) return msg.Substring(start + 1, end - start - 1);
            }
            return msg.Contains("RATE_LIMITED") ? ErrorCode.RateLimited : null;
        }

        static string UserArg(string userId) => string.IsNullOrEmpty(userId) ? "{}" : "{\"userId\":" + JsonString(userId) + "}";

        static string JsonString(string s)
        {
            var sb = new StringBuilder("\"");
            foreach (var c in s)
            {
                if (c == '"' || c == '\\') sb.Append('\\').Append(c);
                else if (c < ' ') sb.Append($"\\u{(int)c:x4}");
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }

        // ---- friends: Nakama's own friend API (docs/protokol.md, Arkadaşlar) ----

        /// <summary>Nakama friend states.</summary>
        public const int FriendMutual = 0, FriendInviteSent = 1, FriendInviteReceived = 2, FriendBlocked = 3;

        public readonly struct Friend
        {
            public readonly string UserId, Username;
            public readonly int State;
            public Friend(string id, string name, int state) { UserId = id; Username = name; State = state; }
        }

        /// <summary>Sends a request, or accepts one when the other side already asked.</summary>
        public Task AddFriendAsync(string userId = null, string username = null) =>
            client.AddFriendsAsync(Session, userId != null ? new[] { userId } : null, username != null ? new[] { username } : null);

        public Task RemoveFriendAsync(string userId) => client.DeleteFriendsAsync(Session, new[] { userId });

        public async Task<List<Friend>> ListFriendsAsync()
        {
            var list = await client.ListFriendsAsync(Session, null, 100, null);
            var result = new List<Friend>();
            foreach (var f in list.Friends) result.Add(new Friend(f.User.Id, f.User.Username, f.State));
            return result;
        }

        public async Task<FriendsStatusResponse> FriendsStatusAsync()
        {
            var rpc = await client.RpcAsync(Session, "friends_status", "{}");
            return JsonUtility.FromJson<FriendsStatusResponse>(rpc.Payload);
        }

        /// <summary>Joins a world server; <paramref name="near"/> lands beside that friend (cross-server "Yanına git").</summary>
        public async Task JoinAsync(string matchId, string characterId = "default", string near = null)
        {
            await CloseAsync();
            ClosedReason = null;
            lock (inbox) inbox.Clear();

            var s = client.NewSocket(useMainThread: true);
            socket = s;
            s.ReceivedNotification += n =>
            {
                lock (notices) notices.Enqueue(new Notice(n.Code, n.Subject, n.Content, n.SenderId));
            };
            s.ReceivedMatchState += state =>
            {
                var json = Encoding.UTF8.GetString(state.State);
                lock (inbox) inbox.Enqueue(new Incoming(state.OpCode, json));
            };
            // Only the current socket counts; closing an old one on rejoin is not a disconnect.
            s.Closed += reason =>
            {
                if (ReferenceEquals(s, socket)) ClosedReason = string.IsNullOrEmpty($"{reason}") ? Loc.T("net.closed") : $"{reason}";
            };

            await s.ConnectAsync(Session, appearOnline: false);
            var metadata = new Dictionary<string, string>
            {
                ["protocolVersion"] = Protocol.Version.ToString(),
                ["characterId"] = characterId,
            };
            if (!string.IsNullOrEmpty(near)) metadata["near"] = near;
            await s.JoinMatchAsync(matchId, metadata);
            MatchId = matchId;
        }

        public bool TryDequeue(out Incoming message)
        {
            lock (inbox)
            {
                if (inbox.Count > 0)
                {
                    message = inbox.Dequeue();
                    return true;
                }
            }
            message = default;
            return false;
        }

        public bool TryDequeueNotice(out Notice notice)
        {
            lock (notices)
            {
                if (notices.Count > 0)
                {
                    notice = notices.Dequeue();
                    return true;
                }
            }
            notice = default;
            return false;
        }

        public void Send(long op, object body)
        {
            if (socket == null || MatchId == null || !socket.IsConnected) return;
            socket.SendMatchStateAsync(MatchId, op, JsonUtility.ToJson(body)).ContinueWith(
                t => Debug.LogWarning($"[Net] Send op {op} failed: {t.Exception?.GetBaseException().Message}"),
                TaskContinuationOptions.OnlyOnFaulted);
        }

        public async Task CloseAsync()
        {
            var s = socket;
            socket = null;
            MatchId = null;
            if (s == null) return;
            try
            {
                await s.CloseAsync();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Net] Close failed: {e.Message}");
            }
        }

        /// <summary>Turns SDK / server errors into a short message (in the chosen language) for the login screen.</summary>
        public static string Explain(Exception e)
        {
            var msg = e.GetBaseException().Message ?? "";
            if (msg.Contains(ErrorCode.ProtocolMismatch)) return Loc.T("net.err.protocol");
            if (msg.Contains(ErrorCode.ServerFull)) return Loc.T("net.err.server_full");
            if (msg.Contains(ErrorCode.BadRequest) || msg.Contains("invalid username"))
                return Loc.T("net.err.bad_username");
            if (msg.Contains("Username is already in use") || msg.Contains("already in use"))
                return Loc.T("net.err.username_taken");
            if (msg.Contains("Cannot connect") || msg.Contains("Connection refused") || msg.Contains("ConnectionError") || msg.Contains("timed out"))
                return Loc.T("net.err.cannot_connect");
            return msg;
        }
    }

    /// <summary>
    /// Device id for Nakama's authenticateDevice. One random id per install, plus the
    /// username so two players on the same Mac (editor + build) get two accounts.
    /// SystemInfo.deviceUniqueIdentifier is empty on WebGL, so we keep our own.
    /// </summary>
    public static class DeviceIds
    {
        const string Key = "cg_install_id";

        public static string For(string username)
        {
            var install = PlayerPrefs.GetString(Key, "");
            if (string.IsNullOrEmpty(install))
            {
                install = Guid.NewGuid().ToString("N");
                PlayerPrefs.SetString(Key, install);
                PlayerPrefs.Save();
            }
            // Nakama wants 10–128 characters.
            return $"{install}-{username.Trim().ToLowerInvariant()}";
        }
    }
}
