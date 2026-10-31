using System;
using System.Collections.Generic;
using CollectionGame.Fishing;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace CollectionGame.World
{
    /// <summary>
    /// Fills the uGUI HUD (Resources/UI/Hud, draft hud3) from the world's state and wires its buttons.
    /// Also owns the chat line: Enter focuses it, Enter sends (SAY, or a whisper for "/w ad mesaj"),
    /// Esc leaves it. The chat log shows the last lines heard nearby.
    /// </summary>
    public sealed class WorldHud
    {
        const int KeptLines = 50;

        public HudView View { get; }
        public PopupView Popup { get; }

        /// <summary>The chat line has the keyboard.</summary>
        public bool ChatFocused => View != null && View.chat.isFocused;

        /// <summary>Line typed into the chat and sent with Enter.</summary>
        public Action<string> Submit { get; set; }

        readonly List<string> log = new List<string>();
        int submittedFrame = -1;
        bool closed;
        string baitName;
        int unread;

        public WorldHud()
        {
            var ui = UiRoot.Get();
            View = ui.Spawn<HudView>("Hud");
            Popup = ui.Spawn<PopupView>("Popup");
            HoverTip.Popup = Popup;
            if (View != null)
            {
                // The bait's name on hover: the text beside the slot stays short (it ran into the chat line).
                View.bait.Hovered = _ => Popup?.ShowTooltip(new PopupView.Card { title = baitName ?? "Yem", note = "Tıkla ya da Y: yemi değiştir" });
                View.bait.Left = _ => Popup?.HideTooltip();
            }
            if (View == null) return;
            View.chat.onEndEdit.AddListener(OnEndEdit);
            View.send.onClick.AddListener(() => Send(View.chat.text));
            View.chatClose.onClick.AddListener(() => SetClosed(true));
            View.chatOpen.onClick.AddListener(() => SetClosed(false));
            RefreshChat();
        }

        public void Destroy()
        {
            if (View != null) UnityEngine.Object.Destroy(View.gameObject);
            if (Popup != null) UnityEngine.Object.Destroy(Popup.gameObject);
        }

        public static void On(Button b, Action a) => b.onClick.AddListener(() => a());

        // ---------- chat ----------

        /// <summary>Enter while nothing has the keyboard: focus the chat line.</summary>
        public void TryOpenChat()
        {
            if (View == null || Time.frameCount <= submittedFrame + 1) return;
            var k = Keyboard.current;
            if (k == null || !(k.enterKey.wasPressedThisFrame || k.numpadEnterKey.wasPressedThisFrame)) return;
            View.chat.Select();
            View.chat.ActivateInputField();
        }

        void OnEndEdit(string text)
        {
            var k = Keyboard.current;
            var enter = k != null && (k.enterKey.wasPressedThisFrame || k.numpadEnterKey.wasPressedThisFrame);
            if (enter) Send(text);
            else Leave();
        }

        void Send(string text)
        {
            text = (text ?? "").Trim();
            if (text.Length > 0) Submit?.Invoke(text);
            View.chat.text = "";
            submittedFrame = Time.frameCount;
            Leave();
        }

        void Leave()
        {
            View.chat.DeactivateInputField();
            if (EventSystem.current != null) EventSystem.current.SetSelectedGameObject(null);
        }

        /// <summary>Adds a line to the chat log ("name: text"); colour is a hex like e6904e.</summary>
        public void AddLog(string name, string text, string colour = "e6904e")
        {
            if (View == null) return;
            log.Add($"<color=#{colour}>{Escape(name)}:</color> {Escape(text)}");
            while (log.Count > KeptLines) log.RemoveAt(0);
            if (closed) unread++;
            RefreshChat();
        }

        /// <summary>Closes or opens the log; the chat line stays either way (31.10.2026, Onur).</summary>
        void SetClosed(bool value)
        {
            closed = value;
            if (!closed) unread = 0;
            RefreshChat();
        }

        /// <summary>Shows the chat as it is now: log closed (small open button on the line), small or big.</summary>
        void RefreshChat()
        {
            var v = View;
            v.chatOpen.gameObject.SetActive(closed);
            v.chatUnread.SetActive(unread > 0);
            var showLog = !closed && log.Count > 0;
            v.chatLogBox.gameObject.SetActive(showLog);
            // The log shows as many lines as its dragged height holds; the box masks the rest.
            var lines = KeptLines;
            v.chatLog.text = string.Join("\n", log.GetRange(Mathf.Max(0, log.Count - lines), Mathf.Min(lines, log.Count)));
        }

        /// <summary>Players type the text: no rich-text tags of theirs get through.</summary>
        static string Escape(string s) => (s ?? "").Replace("<", "<​");

        // ---------- per frame ----------

        public void Tick(string serverName, int peopleInView, FishingController fishing)
        {
            if (View == null) return;
            Set(View.place, serverName ?? "");
            Set(View.info, $"{peopleInView} kişi görüşte");
            Set(View.coin, Kit.Num(fishing.Bag?.coin ?? 0));
            Set(View.diamond, Kit.Num(fishing.Bag?.diamond ?? 0));
            Set(View.dust, Kit.Num(fishing.Bag?.dust ?? 0));

            Set(View.level, $"Lv {Mathf.Max(1, fishing.Level)}");
            var top = fishing.XpNext <= 0;
            HudView.Fill(View.xpFill, top ? 1f : fishing.Xp / (float)fishing.XpNext);
            Set(View.xpText, top ? "XP en yüksek level" : $"XP {Kit.Num(fishing.Xp)} / {Kit.Num(fishing.XpNext)}");

            HudView.Fill(View.energyFill, fishing.EnergyMax > 0 ? fishing.Energy / (float)fishing.EnergyMax : 0f);
            Set(View.energyText, $"Enerji {fishing.Energy}/{fishing.EnergyMax}");

            var rod = fishing.Rod;
            var share = rod != null && rod.max > 0 ? rod.durability / (float)rod.max : 1f;
            HudView.Fill(View.rodFill, share);
            var low = fishing.RodBroken || share < 0.25f;
            var sprite = low ? View.rodLow : View.rodGood;
            if (View.rodFillImage.sprite != sprite) View.rodFillImage.sprite = sprite;
            Set(View.rodText, fishing.RodBroken ? "Olta KIRIK (Tüccar: tamir)" : $"Olta %{Mathf.RoundToInt(share * 100)}");
            var rodColour = low ? new Color(0.91f, 0.23f, 0.23f) : new Color(0.95f, 0.91f, 0.82f);
            if (View.rodText.color != rodColour) View.rodText.color = rodColour;

            var bait = fishing.SelectedBait;
            if (bait == null)
            {
                if (View.bait.Data as string != "") View.bait.SetEmpty();
                View.bait.Data = "";
                Set(View.baitText, "Yem\n(Y)");
                baitName = "Temel yem";
            }
            else
            {
                var n = fishing.StackCount(bait);
                var key = bait + n;
                if (View.bait.Data as string != key) View.bait.SetItem(bait, "", Mathf.Max(n, 2), false);
                View.bait.count.text = n.ToString();
                View.bait.Data = key;
                Set(View.baitText, "Yem\n(Y)");
                baitName = $"{FishingController.ItemName(bait)} · {n} adet";
            }
        }

        static void Set(Text t, string s)
        {
            if (t != null && t.text != s) t.text = s;
        }
    }
}
