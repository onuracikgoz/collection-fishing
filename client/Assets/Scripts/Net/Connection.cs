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

        readonly IClient client;
        readonly Queue<Incoming> inbox = new Queue<Incoming>();
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

        public async Task JoinAsync(string matchId, string characterId = "default")
        {
            await CloseAsync();
            ClosedReason = null;
            lock (inbox) inbox.Clear();

            var s = client.NewSocket(useMainThread: true);
            socket = s;
            s.ReceivedMatchState += state =>
            {
                var json = Encoding.UTF8.GetString(state.State);
                lock (inbox) inbox.Enqueue(new Incoming(state.OpCode, json));
            };
            // Only the current socket counts; closing an old one on rejoin is not a disconnect.
            s.Closed += reason =>
            {
                if (ReferenceEquals(s, socket)) ClosedReason = string.IsNullOrEmpty($"{reason}") ? "Bağlantı kapandı" : $"{reason}";
            };

            await s.ConnectAsync(Session, appearOnline: false);
            var metadata = new Dictionary<string, string>
            {
                ["protocolVersion"] = Protocol.Version.ToString(),
                ["characterId"] = characterId,
            };
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

        /// <summary>Turns SDK / server errors into a short Turkish message for the login screen.</summary>
        public static string Explain(Exception e)
        {
            var msg = e.GetBaseException().Message ?? "";
            if (msg.Contains(ErrorCode.ProtocolMismatch)) return "Oyun sürümü sunucuyla uyuşmuyor. Güncel sürümü kullan.";
            if (msg.Contains(ErrorCode.ServerFull)) return "Sunucu dolu, başka bir sunucu seç.";
            if (msg.Contains(ErrorCode.BadRequest) || msg.Contains("invalid username"))
                return "Kullanıcı adı 3-16 karakter olmalı: harf, rakam ve _ kullanılabilir.";
            if (msg.Contains("Username is already in use") || msg.Contains("already in use"))
                return "Bu kullanıcı adı alınmış, başka bir ad dene.";
            if (msg.Contains("Cannot connect") || msg.Contains("Connection refused") || msg.Contains("ConnectionError") || msg.Contains("timed out"))
                return "Sunucuya bağlanılamadı. Sunucu açık mı? (repo kökünde: docker compose up -d)";
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
