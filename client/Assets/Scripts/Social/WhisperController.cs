using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
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
            public string Text, Name;
            public bool Mine, System, Masked;
        }

        sealed class Chat
        {
            /// <summary>Empty until the first answer when opened by name (/w Nick).</summary>
            public string UserId;
            public string Name;
            public string Context;
            public readonly List<Line> Lines = new List<Line>();
            /// <summary>New message in a minimised or back window: the title blinks.</summary>
            public bool Flash;
            public WhisperView View;
            public bool Minimized, Menu, Report, Sending, LogDirty;
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
            c.Flash = false;
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
            };
            chats.Add(c);
            return c;
        }

        void Focus(Chat c)
        {
            focused = c;
            c.Flash = false;
            if (c.View != null) c.View.window.Raise();
        }

        // ---------- server ----------

        public void OnWhisper(WhisperNotice n)
        {
            Received++;
            Debug.Log($"[Whisper] from {n.fromName}: {n.text}");
            var c = Find(n.from, n.fromName) ?? Create(n.from, n.fromName);
            c.UserId = n.from;
            c.Name = n.fromName;
            Add(c, new Line { Text = n.text, Name = n.fromName });
            c.LastTheirs = n.text;
            if (c.Minimized || focused != c) c.Flash = true;
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
                        CloseChat(c);
                        c = other;
                    }
                    c.UserId = r.to;
                    if (!string.IsNullOrEmpty(r.toName)) c.Name = r.toName;
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
            c.LogDirty = true;
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

        // ---------- UI (uGUI: one Resources/UI/Whisper per conversation) ----------

        WhisperView ViewOf(Chat c)
        {
            if (c.View != null) return c.View;
            var v = UiRoot.Get().Spawn<WhisperView>("Whisper");
            if (v == null) return null;
            c.View = v;
            var rt = (RectTransform)v.window.transform;
            var n = (c.Id - 1) % 5;
            rt.anchoredPosition += new Vector2(-n * 24f, n * 24f); // cascade
            v.window.Closed = () => CloseChat(c);
            v.minimize.onClick.AddListener(() =>
            {
                c.Minimized = true;
                Leave(c);
            });
            v.menuButton.onClick.AddListener(() =>
            {
                c.Menu = !c.Menu;
                c.Report = false;
            });
            v.block.onClick.AddListener(() => Block(c));
            v.report.onClick.AddListener(() => c.Report = true);
            for (var i = 0; i < v.reasons.Length && i < ReportReasons.Length; i++)
            {
                var id = ReportReasons[i].id;
                v.reasons[i].onClick.AddListener(() => Report(c, id));
            }
            v.send.onClick.AddListener(() => SendInput(c));
            v.input.onEndEdit.AddListener(_ =>
            {
                var k = UnityEngine.InputSystem.Keyboard.current;
                if (k != null && (k.enterKey.wasPressedThisFrame || k.numpadEnterKey.wasPressedThisFrame))
                {
                    SendInput(c);
                    v.input.ActivateInputField(); // keep writing
                }
            });
            v.strip.onClick.AddListener(() =>
            {
                c.Minimized = false;
                Focus(c);
                focusField = c;
            });
            v.window.Raise();
            c.LogDirty = true;
            return v;
        }

        void SendInput(Chat c)
        {
            var text = c.View.input.text;
            c.View.input.text = "";
            Send(c, text);
        }

        static void Leave(Chat c)
        {
            if (c.View == null) return;
            c.View.input.DeactivateInputField();
            if (UnityEngine.EventSystems.EventSystem.current != null) UnityEngine.EventSystems.EventSystem.current.SetSelectedGameObject(null);
        }

        void CloseChat(Chat c)
        {
            Leave(c);
            chats.Remove(c);
            if (focused == c) focused = null;
            if (c.View != null) UnityEngine.Object.Destroy(c.View.gameObject);
        }

        public void Destroy()
        {
            foreach (var c in chats)
                if (c.View != null) UnityEngine.Object.Destroy(c.View.gameObject);
            chats.Clear();
        }

        /// <summary>Call every frame: shows each conversation as a window or a strip, blinks new ones.</summary>
        public void Tick()
        {
            var blink = Mathf.Repeat(Time.unscaledTime, 0.8f) < 0.4f;
            var strip = 0;
            foreach (var c in chats.ToList())
            {
                var v = ViewOf(c);
                if (v == null) continue;
                if (v.window.Open == c.Minimized) v.window.Open = !c.Minimized;
                if (v.strip.gameObject.activeSelf != c.Minimized) v.strip.gameObject.SetActive(c.Minimized);
                if (v.window.title.text != c.Name) v.window.title.text = c.Name;
                if (v.stripText.text != c.Name) v.stripText.text = c.Name;
                if (c.Minimized) ((RectTransform)v.strip.transform).anchoredPosition = new Vector2(12f + strip++ * 134f, 96f);
                if (v.menuRow.gameObject.activeSelf != (c.Menu && !c.Report)) v.menuRow.gameObject.SetActive(c.Menu && !c.Report);
                if (v.reasonRow.gameObject.activeSelf != (c.Menu && c.Report)) v.reasonRow.gameObject.SetActive(c.Menu && c.Report);
                var known = !string.IsNullOrEmpty(c.UserId);
                v.block.interactable = v.report.interactable = known;
                v.send.interactable = !c.Sending;

                // Clicking a window brings it forward and stops its blink.
                if (v.input.isFocused && focused != c) Focus(c);
                if (focused == c) c.Flash = false;
                var tint = c.Flash && blink ? new Color(1f, 0.85f, 0.45f) : Color.white;
                if (v.plateImage.color != tint) v.plateImage.color = tint;
                if (v.strip.targetGraphic.color != tint) v.strip.targetGraphic.color = tint;

                if (c.LogDirty)
                {
                    c.LogDirty = false;
                    DrawLog(c, v);
                    Canvas.ForceUpdateCanvases();
                    v.scroll.verticalNormalizedPosition = 0f;
                }
                if (focusField == c && !c.Minimized)
                {
                    focusField = null;
                    v.window.Raise();
                    v.input.Select();
                    v.input.ActivateInputField();
                }
            }
        }

        static readonly Color Ink = new Color32(0x45, 0x29, 0x3f, 0xff);
        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);
        static readonly Color Theirs = new Color32(0x1e, 0x6f, 0x50, 0xff);
        static readonly Color Mine = new Color32(0x9e, 0x45, 0x39, 0xff);
        static readonly Color SystemLine = new Color32(0x9e, 0x45, 0x39, 0xff);

        /// <summary>One row per message: nick on top, text under it; mine on the right, system notes without a nick.</summary>
        static void DrawLog(Chat c, WhisperView v)
        {
            var rows = v.log.GetComponentsInChildren<WhisperLine>(true);
            var have = 0;
            foreach (var r in rows)
                if (r != v.lineTemplate) have++;
            for (var i = have; i < c.Lines.Count; i++)
                UnityEngine.Object.Instantiate(v.lineTemplate, v.log, false).name = "Line";
            var k = 0;
            foreach (var r in v.log.GetComponentsInChildren<WhisperLine>(true))
            {
                if (r == v.lineTemplate) continue;
                if (k >= c.Lines.Count)
                {
                    r.gameObject.SetActive(false);
                    continue;
                }
                var l = c.Lines[k++];
                r.gameObject.SetActive(true);
                if (l.System) r.Set(null, l.Text, false, Faint, l.Masked ? Faint : SystemLine);
                else if (l.Mine) r.Set("Sen", l.Text, true, Mine, Ink);
                else r.Set(l.Name, l.Text, false, Theirs, Ink);
            }
        }

    }
}
