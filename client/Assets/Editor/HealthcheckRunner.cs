using System;
using System.Threading.Tasks;
using Nakama;
using UnityEditor;
using UnityEngine;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// Batch-mode smoke test for the "healthcheck" RPC. Needs the local server
    /// (`docker compose up -d`) and the editor closed on this project:
    /// Unity -batchmode -nographics -projectPath client -executeMethod CollectionGame.EditorTools.HealthcheckRunner.Run -logFile -
    /// Exits 0 when the server answers {"ok":true,...}, otherwise 1.
    /// </summary>
    public static class HealthcheckRunner
    {
        const double TimeoutSeconds = 30;

        static Task<string> pending;
        static double deadline;

        public static void Run()
        {
            // Default HttpClient adapter: works off the main thread, so no Play mode needed.
            var client = new Client("http", "127.0.0.1", 7350, "defaultkey");
            pending = CallAsync(client);
            deadline = EditorApplication.timeSinceStartup + TimeoutSeconds;
            EditorApplication.update += Poll;
        }

        static async Task<string> CallAsync(IClient client)
        {
            var session = await client.AuthenticateDeviceAsync("healthcheck-runner-" + SystemInfo.deviceUniqueIdentifier, create: true);
            var rpc = await client.RpcAsync(session, "healthcheck", "{}");
            return rpc.Payload;
        }

        static void Poll()
        {
            if (!pending.IsCompleted)
            {
                if (EditorApplication.timeSinceStartup < deadline) return;
                Finish(1, $"[Healthcheck] Timed out after {TimeoutSeconds}s");
                return;
            }

            if (pending.IsFaulted)
            {
                Finish(1, $"[Healthcheck] Failed: {pending.Exception?.GetBaseException().Message}");
                return;
            }

            var payload = pending.Result;
            var ok = payload != null && payload.Replace(" ", "").Contains("\"ok\":true");
            Finish(ok ? 0 : 1, $"[Healthcheck] payload: {payload}");
        }

        static void Finish(int code, string message)
        {
            EditorApplication.update -= Poll;
            if (code == 0) Debug.Log(message); else Debug.LogError(message);
            EditorApplication.Exit(code);
        }
    }
}
