using System;
using Nakama;
using UnityEngine;

namespace CollectionGame.Net
{
    /// <summary>
    /// Phase 0 smoke test: logs in with a device id and calls the server's
    /// "healthcheck" RPC. Runs automatically when you press Play.
    /// Needs the local server: `docker compose up -d` in the repo root.
    /// </summary>
    public class NakamaHealthcheck : MonoBehaviour
    {
        [SerializeField] string scheme = "http";
        [SerializeField] string host = "127.0.0.1";
        [SerializeField] int port = 7350;
        [SerializeField] string serverKey = "defaultkey";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoStart()
        {
            if (FindAnyObjectByType<NakamaHealthcheck>() != null) return;
            new GameObject(nameof(NakamaHealthcheck)).AddComponent<NakamaHealthcheck>();
        }

        async void Start()
        {
            var client = new Client(scheme, host, port, serverKey, UnityWebRequestAdapter.Instance);
            try
            {
                var session = await client.AuthenticateDeviceAsync(DeviceId(), create: true);
                var rpc = await client.RpcAsync(session, "healthcheck", "{}");
                Debug.Log($"[Nakama] Connected as {session.Username}. healthcheck: {rpc.Payload}");
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Nakama] Healthcheck failed. Is the server running (docker compose up -d)? {e.Message}");
            }
        }

        // SystemInfo.deviceUniqueIdentifier is empty on WebGL, so keep our own id.
        static string DeviceId()
        {
            const string key = "cg_device_id";
            var id = PlayerPrefs.GetString(key, "");
            if (string.IsNullOrEmpty(id))
            {
                id = SystemInfo.deviceUniqueIdentifier;
                if (string.IsNullOrEmpty(id) || id == SystemInfo.unsupportedIdentifier) id = Guid.NewGuid().ToString();
                PlayerPrefs.SetString(key, id);
                PlayerPrefs.Save();
            }
            return id;
        }
    }
}
