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
        static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

        public static void Run()
        {
            int code;
            string message;
            try
            {
                // Task.Run drops Unity's SynchronizationContext, so blocking here can't deadlock the main thread.
                var call = Task.Run(CallAsync);
                if (!call.Wait(Timeout))
                {
                    code = 1;
                    message = $"[Healthcheck] Timed out after {Timeout.TotalSeconds}s";
                }
                else
                {
                    var payload = call.Result;
                    code = payload != null && payload.Replace(" ", "").Contains("\"ok\":true") ? 0 : 1;
                    message = $"[Healthcheck] payload: {payload}";
                }
            }
            catch (Exception e)
            {
                code = 1;
                message = $"[Healthcheck] Failed: {e.GetBaseException().Message}";
            }

            if (code == 0) Debug.Log(message); else Debug.LogError(message);
            EditorApplication.Exit(code);
        }

        static async Task<string> CallAsync()
        {
            // Default HttpClient adapter: works without Play mode.
            var client = new Client("http", "127.0.0.1", 7350, "defaultkey");
            var session = await client.AuthenticateDeviceAsync("healthcheck-runner-" + Environment.MachineName, create: true);
            var rpc = await client.RpcAsync(session, "healthcheck", "{}");
            return rpc.Payload;
        }
    }
}
