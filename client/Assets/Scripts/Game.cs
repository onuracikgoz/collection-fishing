using System;
using CollectionGame.Dev;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.World;
using CollectionGame.UI.Views;
using System.Collections.Generic;
using System.Linq;
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

        enum Page { Login, Guest, Character, Servers, Busy, World }

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

            Busy(Loc.T("login.busy.logging_in"));
            try
            {
                net = new Connection(host);
                await net.LoginAsync(username);
                await Loc.FetchAsync(net); // server text fixes over the bundled files (never throws)
                Busy(Loc.T("login.busy.items"));
                await ItemContent.LoadAsync(net);
                await RefreshServers();
            }
            catch (Exception e)
            {
                Fail(Page.Login, e);
            }
        }

        async System.Threading.Tasks.Task RefreshServers()
        {
            Busy(Loc.T("login.busy.servers"));
            servers = await net.ListServersAsync();
            error = null;
            var friendsOn = new Dictionary<string, int>();
            try
            {
                var status = await net.FriendsStatusAsync();
                foreach (var f in status?.friends ?? Array.Empty<FriendStatus>())
                    if (f.online && !string.IsNullOrEmpty(f.serverName))
                        friendsOn[f.serverName] = friendsOn.TryGetValue(f.serverName, out var n) ? n + 1 : 1;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Game] friends_status failed: {e.Message}");
            }
            FillServers(friendsOn);
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

        /// <param name="near">Friend to land beside ("Yanına git" across servers).</param>
        async void Join(ServerInfo server, string near = null)
        {
            DestroyWorld();
            Busy(Loc.T("login.busy.joining", ("server", server.name)));
            try
            {
                await ItemContent.LoadAsync(net); // new items / images since login
                // The world exists before joining: WELCOME can arrive before JoinAsync returns.
                world = WorldController.Create(net, server.name, OnDisconnected,
                    (matchId, name, friend) => Join(new ServerInfo { matchId = matchId, name = name }, friend));
                if (Autopilot.Enabled) Autopilot.Attach(world);
                screen = Page.World;
                await net.JoinAsync(server.matchId, near: near);
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
            error = Loc.T("login.disconnected", ("reason", reason));
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

        // ---------- uGUI (Resources/UI/Login, drafts _akis-1..7) ----------

        static readonly string[] Tips =
        {
            "login.tip.1", "login.tip.2", "login.tip.3", "login.tip.4",
        };

        LoginView view;
        float busySince;
        string tip;

        bool EnsureView()
        {
            if (view != null) return true;
            view = UiRoot.Get().Spawn<LoginView>("Login");
            if (view == null) return false;
            view.version.text = $"v{Application.version} · {(Application.platform == RuntimePlatform.WebGLPlayer ? "Web" : "Mac")}";
            view.play.onClick.AddListener(() =>
            {
                error = null;
                if (!string.IsNullOrWhiteSpace(username)) Login();
                else screen = Page.Guest;
            });
            view.settings.onClick.AddListener(() =>
            {
                view.hostField.SetTextWithoutNotify(host);
                view.host.Open = !view.host.Open;
            });
            view.settings.gameObject.SetActive(Application.platform != RuntimePlatform.WebGLPlayer);
            view.hostSave.onClick.AddListener(() =>
            {
                host = view.hostField.text.Trim();
                PlayerPrefs.SetString(HostKey, host);
                PlayerPrefs.Save();
                view.host.Open = false;
            });
            view.guest.Closed = () => screen = Page.Login;
            view.guestPlay.onClick.AddListener(() =>
            {
                error = null;
                view.nameField.SetTextWithoutNotify(username);
                screen = Page.Character;
            });
            view.character.Closed = () => screen = Page.Guest;
            view.back.onClick.AddListener(() => screen = Page.Guest);
            view.next.onClick.AddListener(() =>
            {
                username = view.nameField.text.Trim();
                if (username.Length == 0) return;
                Login();
            });
            view.nameField.onEndEdit.AddListener(_ =>
            {
                var k = UnityEngine.InputSystem.Keyboard.current;
                if (k != null && (k.enterKey.wasPressedThisFrame || k.numpadEnterKey.wasPressedThisFrame) && view.nameField.text.Trim().Length > 0)
                {
                    username = view.nameField.text.Trim();
                    Login();
                }
            });
            view.servers.Closed = () => screen = Page.Login;
            view.refresh.onClick.AddListener(Refresh);
            view.logout.onClick.AddListener(() =>
            {
                error = null;
                username = "";
                PlayerPrefs.SetString(UsernameKey, "");
                screen = Page.Login;
            });
            for (var i = 0; i < view.rows.Length; i++)
            {
                var index = i;
                view.rows[i].go.onClick.AddListener(() =>
                {
                    if (index < servers.Length) Join(servers[index]);
                });
            }
            return true;
        }

        void Update()
        {
            if (!EnsureView()) return;
            var inWorld = screen == Page.World && world != null && world.Ready;
            if (view.gameObject.activeSelf == inWorld) view.gameObject.SetActive(!inWorld);
            if (inWorld) return;
            view.transform.SetAsLastSibling();

            var loading = screen == Page.Busy || screen == Page.World;
            view.titlePlate.SetActive(screen != Page.Character && screen != Page.Servers);
            // _akis-2 lifts the name plate above the "Oyuna gir" window.
            ((RectTransform)view.titlePlate.transform).anchoredPosition = new Vector2(444, screen == Page.Guest ? -96 : -140);
            view.title.SetActive(screen == Page.Login);
            if (screen != Page.Login && view.host.Open) view.host.Open = false;
            Show(view.guest, screen == Page.Guest);
            Show(view.character, screen == Page.Character);
            Show(view.servers, screen == Page.Servers);
            if (view.loading.activeSelf != loading)
            {
                view.loading.SetActive(loading);
                busySince = Time.time;
                tip = Tips[UnityEngine.Random.Range(0, Tips.Length)];
            }
            if (loading)
            {
                view.loadingText.text = screen == Page.World ? busyText ?? Loc.T("login.busy.connecting") : busyText;
                // There is no real progress to report: the bar fills slowly while waiting.
                HudView.Fill(view.loadingFill, 1f - Mathf.Exp(-(Time.time - busySince) / 1.5f));
                view.tip.text = Loc.T(tip);
            }
            var err = error ?? "";
            if (view.error.text != err) view.error.text = err;
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

        static void Show(WindowView w, bool on)
        {
            if (w.Open != on) w.Open = on;
        }

        /// <summary>Server rows (_akis-6): flag, name, friends there, how full, Gir.</summary>
        void FillServers(Dictionary<string, int> friendsOn)
        {
            if (!EnsureView()) return;
            var best = friendsOn.Count > 0 ? friendsOn.OrderByDescending(p => p.Value).First().Key : null;
            view.greeting.text = Loc.T(best != null ? "login.greeting.friends" : "login.greeting", ("name", net.Username));
            var ordered = servers.OrderByDescending(s => friendsOn.TryGetValue(s.name, out var n) ? n : 0).ToArray();
            servers = ordered;
            for (var i = 0; i < view.rows.Length; i++)
            {
                var r = view.rows[i];
                var s = i < servers.Length ? servers[i] : null;
                r.root.SetActive(s != null);
                if (s == null) continue;
                friendsOn.TryGetValue(s.name, out var friends);
                r.back.sprite = friends > 0 ? view.rowFriends : view.rowPlain;
                r.flag.sprite = s.language == "en" ? view.flagEn : view.flagTr;
                r.name.text = s.name;
                r.friends.text = friends > 0 ? Loc.T("login.server.friends", ("count", friends)) : "";
                var share = s.capacity > 0 ? (float)s.players / s.capacity : 0f;
                HudView.Fill(r.fill, share);
                r.fillImage.sprite = share >= 0.9f ? view.fillRed : share >= 0.6f ? view.fillYellow : view.fillGreen;
                r.count.text = $"{s.players} / {s.capacity}";
                r.warn.text = share >= 0.9f ? Loc.T("login.server.almost_full") : "";
                r.go.interactable = s.players < s.capacity;
            }
        }
    }
}
