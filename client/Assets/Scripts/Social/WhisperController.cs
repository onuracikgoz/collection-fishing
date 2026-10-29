using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Net;
using CollectionGame.UI;
using UnityEngine;

namespace CollectionGame.Social
{
    /// <summary>
    /// Whispers, Knight Online style (docs/araclar/ui-uygulama.md, Fısıltı penceresi; docs/protokol.md,
    /// Fısıltı): one small window per conversation, several open at once, dragged by the title.
    /// "_" minimises it to a strip at the bottom edge; closing it forgets the conversation and a new
    /// message opens it again. A new message in a minimised or back window makes its title blink.
    /// Sending is the whisper_send RPC; incoming whispers are notification 110 on the socket.
    /// The title menu has Engelle (Nakama blockFriends) and Raporla (report_player).
    /// </summary>
    public sealed class WhisperController
    {
        const int MaxLines = 60;
        const int TextMax = 120; // the server trims to the chat limit too
        static readonly (string id, string label)[] ReportReasons =
        {
            ("spam", "Spam"), ("abuse", "Hakaret"), ("scam", "Dolandırıcılık"),
            ("personal_info", "Kişisel bilgi"), ("cheating", "Hile"), ("other", "Diğer"),
        };

        sealed class Line
        {
            public string Text;
            public bool Mine, System, Masked;
        }

        sealed class Chat
        {
            /// <summary>Empty until the first answer when opened by name (/w Nick).</summary>
            public string UserId;
            public string Name;
            public string Context;
            public readonly List<Line> Lines = new List<Line>();
            public KitWindow Window;
            public bool Minimized, Menu, Report, Sending;
            public string Input = "";
            public Vector2 Scroll;
            public string LastTheirs;
            /// <summary>Stable text field name while windows change order.</summary>
            public int Id;
        }

        readonly Connection net;
        readonly List<Chat> chats = new List<Chat>();
        Chat focused;
        Chat focusField;
        int nextId;

        public int Received { get; private set; }
        public int Open => chats.Count;

        public WhisperController(Connection net) => this.net = net;

        // ---------- opening ----------

        /// <summary>Opens (or brings back) the conversation with a player. context "stall" from a pet stall.</summary>
        public void OpenWith(string userId, string name, string context = null)
        {
            if (userId == net.UserId) return;
            var c = Find(userId, name) ?? Create(userId, name);
            if (!string.IsNullOrEmpty(context)) c.Context = context;
            c.Minimized = false;
            c.Window.Flash = false;
            Focus(c);
            focusField = c;
        }

        /// <summary>"/w Nick mesaj" from the chat line. Returns false when the text is not a whisper command.</summary>
        public bool TryCommand(string line)
        {
            if (line == null) return false;
            var t = line.Trim();
            if (!(t.StartsWith("/w ", StringComparison.OrdinalIgnoreCase) || t.StartsWith("/f ", StringComparison.OrdinalIgnoreCase))) return false;
            var rest = t.Substring(3).Trim();
            var space = rest.IndexOf(' ');
            var name = space < 0 ? rest : rest.Substring(0, space);
            var text = space < 0 ? "" : rest.Substring(space + 1).Trim();
            if (name.Length == 0)
            {
                Toasts.Show("Kullanım: /w Ad mesaj");
                return true;
            }
            var c = Find(null, name) ?? Create(null, name);
            c.Minimized = false;
            Focus(c);
            if (text.Length > 0) Send(c, text);
            else focusField = c;
            return true;
        }

        Chat Find(string userId, string name)
        {
            if (!string.IsNullOrEmpty(userId))
            {
                var byId = chats.FirstOrDefault(c => c.UserId == userId);
                if (byId != null) return byId;
            }
            return string.IsNullOrEmpty(name) ? null : chats.FirstOrDefault(c => string.Equals(c.Name, name, StringComparison.OrdinalIgnoreCase));
        }

        Chat Create(string userId, string name)
        {
            var c = new Chat
            {
                UserId = userId ?? "",
                Name = name,
                Id = ++nextId,
                Window = new KitWindow(name, 270f, 190f) { Extra = new[] { "_", "≡" } },
            };
            // Cascade new windows from the lower right so they do not cover the middle of the screen.
            var n = chats.Count % 5;
            c.Window.Rect.position = new Vector2(Gui.Width - 290f - n * 24f, Gui.Height - 330f - n * 24f);
            chats.Add(c);
            return c;
        }

        void Focus(Chat c)
        {
            focused = c;
            c.Window.Flash = false;
            // Drawn last = on top.
            chats.Remove(c);
            chats.Add(c);
        }

        // ---------- server ----------

        public void OnWhisper(WhisperNotice n)
        {
            Received++;
            Debug.Log($"[Whisper] from {n.fromName}: {n.text}");
            var c = Find(n.from, n.fromName) ?? Create(n.from, n.fromName);
            c.UserId = n.from;
            c.Name = n.fromName;
            c.Window.Title = n.fromName;
            Add(c, new Line { Text = n.text });
            c.LastTheirs = n.text;
            if (c.Minimized || focused != c) c.Window.Flash = true;
            if (focused == null) focused = c;
        }

        async void Send(Chat c, string text)
        {
            text = text.Trim();
            if (text.Length == 0 || c.Sending) return;
            if (text.Length > TextMax) text = text.Substring(0, TextMax);
            c.Sending = true;
            try
            {
                var useId = !string.IsNullOrEmpty(c.UserId);
                var r = await net.WhisperAsync(useId ? c.UserId : null, useId ? null : c.Name, text, c.Context);
                if (!string.IsNullOrEmpty(r.to))
                {
                    // Opened by name: now we know who it is. Merge into an existing window with them.
                    var other = chats.FirstOrDefault(x => x != c && x.UserId == r.to);
                    if (other != null)
                    {
                        other.Lines.AddRange(c.Lines);
                        chats.Remove(c);
                        c = other;
                    }
                    c.UserId = r.to;
                    if (!string.IsNullOrEmpty(r.toName))
                    {
                        c.Name = r.toName;
                        c.Window.Title = r.toName;
                    }
                }
                Add(c, new Line { Text = r.text ?? text, Mine = true });
                if (r.masked) Add(c, new Line { Text = "Kişisel bilgi gizlendi", System = true, Masked = true });
            }
            catch (Exception e)
            {
                var code = Connection.ErrorOf(e);
                Debug.LogWarning($"[Whisper] send failed: {code} {e.GetBaseException().Message}");
                Add(c, new Line { Text = Explain(code), System = true });
            }
            c.Sending = false;
        }

        public static string Explain(string code)
        {
            switch (code)
            {
                case ErrorCode.Offline: return "Oyuncu çevrimiçi değil";
                case ErrorCode.NotAllowed: return "Bu oyuncuya şu an yazamazsın";
                case ErrorCode.LevelTooLow: return "Yabancılara yazmak için level 10 gerekir";
                case ErrorCode.Muted: return "Susturuldun";
                case ErrorCode.YouBlocked: return "Bu oyuncuyu engelledin";
                case ErrorCode.RateLimited: return "Çok hızlı yazıyorsun";
                case ErrorCode.NotFound: return "Böyle bir oyuncu yok";
                case ErrorCode.Self: return "Kendine fısıldayamazsın";
                case ErrorCode.BadRequest: return "Mesaj boş ya da geçersiz";
                default: return "Gönderilemedi";
            }
        }

        static void Add(Chat c, Line line)
        {
            c.Lines.Add(line);
            while (c.Lines.Count > MaxLines) c.Lines.RemoveAt(0);
            c.Scroll.y = float.MaxValue;
        }

        async void Block(Chat c)
        {
            c.Menu = false;
            if (string.IsNullOrEmpty(c.UserId)) return;
            try
            {
                await net.BlockAsync(c.UserId);
                Add(c, new Line { Text = $"{c.Name} engellendi", System = true });
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Whisper] block failed: {e.Message}");
                Add(c, new Line { Text = "Engellenemedi", System = true });
            }
        }

        async void Report(Chat c, string reason)
        {
            c.Report = false;
            c.Menu = false;
            if (string.IsNullOrEmpty(c.UserId)) return;
            try
            {
                await net.ReportAsync(c.UserId, reason, null, c.LastTheirs);
                Add(c, new Line { Text = "Raporun alındı. Teşekkürler.", System = true });
            }
            catch (Exception e)
            {
                var code = Connection.ErrorOf(e);
                Add(c, new Line { Text = code == ErrorCode.RateLimited ? "Çok fazla rapor gönderdin, sonra tekrar dene" : "Rapor gönderilemedi", System = true });
            }
        }

        // ---------- UI ----------

        /// <summary>Draw before the chat line so Enter in a whisper field is not read as "open chat".</summary>
        public void DrawGui()
        {
            Kit.Begin();
            var strip = 0;
            foreach (var c in chats.ToList())
            {
                if (c.Minimized) DrawStrip(c, strip++);
                else DrawWindow(c);
            }
        }

        void DrawStrip(Chat c, int index)
        {
            var r = new Rect(10f + index * 134f, Gui.Height - Gui.CanvasToGui(96f) - 60f, 128f, 22f);
            Gui.Block(r);
            var old = GUI.color;
            if (c.Window.Flash && Mathf.Repeat(Time.unscaledTime, 0.8f) < 0.4f) GUI.color = new Color(1f, 0.85f, 0.45f);
            if (GUI.Button(r, c.Name, Kit.Plate))
            {
                c.Minimized = false;
                Focus(c);
                focusField = c;
            }
            GUI.color = old;
        }

        void DrawWindow(Chat c)
        {
            var w = c.Window;
            var open = w.Begin();
            if (w.Clicked && focused != c) Focus(c);
            if (focused == c) w.Flash = false;
            if (!open)
            {
                w.End();
                chats.Remove(c);
                if (focused == c) focused = null;
                GUIUtility.keyboardControl = 0;
                return;
            }
            if (w.PressedExtra == 0)
            {
                w.End();
                c.Minimized = true;
                GUIUtility.keyboardControl = 0;
                return;
            }
            if (w.PressedExtra == 1) c.Menu = !c.Menu;

            if (c.Menu)
            {
                GUILayout.BeginVertical(Kit.Card);
                if (!c.Report)
                {
                    GUI.enabled = !string.IsNullOrEmpty(c.UserId);
                    GUILayout.BeginHorizontal();
                    if (GUILayout.Button("Engelle", Kit.Red, GUILayout.Height(20))) Block(c);
                    if (GUILayout.Button("Raporla", Kit.Wood, GUILayout.Height(20))) c.Report = true;
                    GUILayout.EndHorizontal();
                    GUI.enabled = true;
                }
                else
                {
                    GUILayout.Label("Neden?", Kit.Small);
                    for (var i = 0; i < ReportReasons.Length; i += 3)
                    {
                        GUILayout.BeginHorizontal();
                        for (var j = i; j < Mathf.Min(i + 3, ReportReasons.Length); j++)
                            if (GUILayout.Button(ReportReasons[j].label, Kit.Flat, GUILayout.Height(18))) Report(c, ReportReasons[j].id);
                        GUILayout.EndHorizontal();
                    }
                }
                GUILayout.EndVertical();
            }

            c.Scroll = GUILayout.BeginScrollView(c.Scroll);
            foreach (var l in c.Lines)
                GUILayout.Label(l.System ? l.Text : l.Mine ? $"Sen: {l.Text}" : $"{c.Name}: {l.Text}", l.System ? (l.Masked ? Kit.Faint : Kit.Warn) : l.Mine ? Kit.Small : SmallBold);
            GUILayout.EndScrollView();

            var field = "whisper_" + c.Id;
            var e = Event.current;
            var enter = e.type == EventType.KeyDown && (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter) && GUI.GetNameOfFocusedControl() == field;
            if (enter)
            {
                e.Use();
                var text = c.Input;
                c.Input = "";
                Send(c, text);
            }
            else if (e.type == EventType.KeyDown && e.keyCode == KeyCode.Escape && GUI.GetNameOfFocusedControl() == field)
            {
                e.Use();
                GUIUtility.keyboardControl = 0;
            }
            GUILayout.BeginHorizontal();
            GUI.SetNextControlName(field);
            c.Input = GUILayout.TextField(c.Input, TextMax, Kit.Input, GUILayout.Height(22));
            GUI.enabled = !c.Sending && c.Input.Trim().Length > 0;
            if (GUILayout.Button("↵", Kit.Wood, GUILayout.Width(28), GUILayout.Height(22)))
            {
                var text = c.Input;
                c.Input = "";
                Send(c, text);
            }
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            if (focusField == c && e.type == EventType.Repaint)
            {
                GUI.FocusControl(field);
                focusField = null;
            }
            w.End();
        }

        static GUIStyle smallBold;
        static GUIStyle SmallBold => smallBold != null && smallBold.normal.textColor == Kit.Small.normal.textColor
            ? smallBold
            : smallBold = new GUIStyle(Kit.Small) { fontStyle = FontStyle.Bold };
    }
}
