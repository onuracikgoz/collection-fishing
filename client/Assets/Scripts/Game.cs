using System;
using CollectionGame.Dev;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.World;
using UnityEngine;

namespace CollectionGame
{
    /// <summary>
    /// Phase 1 entry point, created automatically in any scene: login screen
    /// (username → device login), server list (list_servers), then the world.
    /// </summary>
    public class Game : MonoBehaviour
    {
        const string UsernameKey = "cg_username";
        const string HostKey = "cg_host";

        enum Page { Login, Servers, Busy, World }

        Page screen = Page.Login;
        string username;
        string host;
        string error;
        string busyText;
        ServerInfo[] servers = Array.Empty<ServerInfo>();
        Connection net;
        WorldController world;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoStart()
        {
            if (FindAnyObjectByType<Game>() != null) return;
            var go = new GameObject(nameof(Game));
            DontDestroyOnLoad(go);
            go.AddComponent<Game>();
        }

        void Awake()
        {
            username = PlayerPrefs.GetString(UsernameKey, "");
            host = Application.platform == RuntimePlatform.WebGLPlayer ? Connection.DefaultHost() : PlayerPrefs.GetString(HostKey, Connection.DefaultHost());
            Application.runInBackground = true; // two windows on one Mac both keep running
        }

        void Start()
        {
            // Command-line test run (Dev/Autopilot.cs): log in without the form.
            if (!Autopilot.Enabled) return;
            username = Autopilot.Arg("-cgUser");
            host = Autopilot.Arg("-cgHost") ?? host;
            Login();
        }

        async void Login()
        {
            username = username.Trim();
            host = string.IsNullOrWhiteSpace(host) ? "127.0.0.1" : host.Trim();
            if (!Autopilot.Enabled)
            {
                PlayerPrefs.SetString(UsernameKey, username);
                PlayerPrefs.SetString(HostKey, host);
                PlayerPrefs.Save();
            }

            Busy("Giriş yapılıyor...");
            try
            {
                net = new Connection(host);
                await net.LoginAsync(username);
                await RefreshServers();
            }
            catch (Exception e)
            {
                Fail(Page.Login, e);
            }
        }

        async System.Threading.Tasks.Task RefreshServers()
        {
            Busy("Sunucular yükleniyor...");
            servers = await net.ListServersAsync();
            error = null;
            screen = Page.Servers;

            var wanted = Autopilot.Enabled ? Autopilot.Arg("-cgServer") : null;
            if (wanted != null)
                foreach (var s in servers)
                    if (string.Equals(s.name, wanted, StringComparison.OrdinalIgnoreCase))
                    {
                        Join(s);
                        break;
                    }
        }

        async void Join(ServerInfo server)
        {
            Busy($"{server.name} sunucusuna giriliyor...");
            try
            {
                // The world exists before joining: WELCOME can arrive before JoinAsync returns.
                world = WorldController.Create(net, server.name, OnDisconnected);
                if (Autopilot.Enabled) Autopilot.Attach(world);
                screen = Page.World;
                await net.JoinAsync(server.matchId);
            }
            catch (Exception e)
            {
                DestroyWorld();
                Fail(Page.Servers, e);
            }
        }

        void OnDisconnected(string reason)
        {
            DestroyWorld();
            _ = net.CloseAsync();
            error = $"Bağlantı koptu: {reason}";
            screen = Page.Servers;
        }

        void DestroyWorld()
        {
            if (world != null) Destroy(world.gameObject);
            world = null;
        }

        void Busy(string text)
        {
            busyText = text;
            error = null;
            screen = Page.Busy;
        }

        void Fail(Page back, Exception e)
        {
            Debug.LogWarning($"[Game] {e}");
            error = Connection.Explain(e);
            screen = back;
        }

        async void OnApplicationQuit()
        {
            if (net != null) await net.CloseAsync();
        }

        void OnGUI()
        {
            if (screen == Page.World) return;
            Gui.Begin();
            var w = 360f;
            var area = new Rect((Gui.Width - w) / 2f, Gui.Height * 0.2f, w, Gui.Height * 0.7f);
            GUI.Box(new Rect(0, 0, Gui.Width, Gui.Height), GUIContent.none);
            GUILayout.BeginArea(area);
            GUILayout.Label("CollectionGame", Gui.Title, GUILayout.Height(48));
            GUILayout.Space(12);

            switch (screen)
            {
                case Page.Login: DrawLogin(); break;
                case Page.Servers: DrawServers(); break;
                case Page.Busy: GUILayout.Label(busyText, Gui.Hud); break;
            }

            if (!string.IsNullOrEmpty(error))
            {
                GUILayout.Space(12);
                GUILayout.Label(error, Gui.Error);
            }
            GUILayout.EndArea();
        }

        void DrawLogin()
        {
            GUILayout.Label("Kullanıcı adı (3-16: harf, rakam, _)", Gui.Hud);
            GUI.SetNextControlName("username");
            username = GUILayout.TextField(username, 16, Gui.Input, GUILayout.Height(32));
            GUILayout.Space(8);
            GUILayout.Label("Sunucu adresi", Gui.Hud);
            host = GUILayout.TextField(host, 64, Gui.Input, GUILayout.Height(32));
            GUILayout.Space(12);

            var e = Event.current;
            var enter = e.type == EventType.KeyDown && (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter);
            if ((GUILayout.Button("Giriş", Gui.Button, GUILayout.Height(36)) || enter) && username.Trim().Length > 0)
            {
                if (enter) e.Use();
                Login();
            }
            if (GUI.GetNameOfFocusedControl() == "") GUI.FocusControl("username");
        }

        void DrawServers()
        {
            GUILayout.Label($"Merhaba {net.Username}! Bir sunucu seç:", Gui.Hud);
            GUILayout.Space(8);
            foreach (var s in servers)
            {
                var label = $"{s.name}  ({s.language})   {s.players}/{s.capacity}";
                if (GUILayout.Button(label, Gui.Button, GUILayout.Height(36))) Join(s);
            }
            GUILayout.Space(12);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Yenile", Gui.Button, GUILayout.Height(30))) Refresh();
            if (GUILayout.Button("Çıkış", Gui.Button, GUILayout.Height(30)))
            {
                error = null;
                screen = Page.Login;
            }
            GUILayout.EndHorizontal();
        }

        async void Refresh()
        {
            try
            {
                await RefreshServers();
            }
            catch (Exception e)
            {
                Fail(Page.Login, e);
            }
        }
    }
}
