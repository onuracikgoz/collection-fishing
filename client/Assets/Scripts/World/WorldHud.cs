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
        const int LogLines = 4;

        public HudView View { get; }
        public PopupView Popup { get; }

        /// <summary>The chat line has the keyboard.</summary>
        public bool ChatFocused => View != null && View.chat.isFocused;

        /// <summary>Line typed into the chat and sent with Enter.</summary>
        public Action<string> Submit { get; set; }

        readonly List<string> log = new List<string>();
        int submittedFrame = -1;

        public WorldHud()
        {
            var ui = UiRoot.Get();
            View = ui.Spawn<HudView>("Hud");
            Popup = ui.Spawn<PopupView>("Popup");
            if (View == null) return;
            View.chatLog.transform.parent.gameObject.SetActive(false);
            View.chat.onEndEdit.AddListener(OnEndEdit);
            View.send.onClick.AddListener(() => Send(View.chat.text));
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
            while (log.Count > LogLines) log.RemoveAt(0);
            View.chatLog.text = string.Join("\n", log);
            View.chatLog.transform.parent.gameObject.SetActive(true);
        }

        /// <summary>Players type the text: no rich-text tags of theirs get through.</summary>
        static string Escape(string s) => (s ?? "").Replace("<", "<​");

        // ---------- per frame ----------

        public void Tick(string serverName, int peopleInView, FishingController fishing, int score, bool questsReady)
        {
            if (View == null) return;
            Set(View.place, serverName ?? "");
            Set(View.info, $"{peopleInView} kişi görüşte");
            Set(View.score, Kit.Num(score));
            Set(View.coin, Kit.Num(fishing.Bag?.coin ?? 0));
            Set(View.diamond, Kit.Num(fishing.Bag?.diamond ?? 0));

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
            Set(View.rodText, fishing.RodBroken ? "Olta KIRIK (E: tamir)" : $"Olta %{Mathf.RoundToInt(share * 100)}");

            var bait = fishing.SelectedBait;
            if (bait == null)
            {
                if (View.bait.Data as string != "") View.bait.SetEmpty();
                View.bait.Data = "";
                Set(View.baitText, "Yem: temel\n(Y)");
            }
            else
            {
                var n = fishing.StackCount(bait);
                var key = bait + n;
                if (View.bait.Data as string != key) View.bait.SetItem(bait, "", Mathf.Max(n, 2), false);
                View.bait.count.text = n.ToString();
                View.bait.Data = key;
                Set(View.baitText, $"Yem\n{FishingController.ItemName(bait)}");
            }
            if (View.questsAlert.activeSelf != questsReady) View.questsAlert.SetActive(questsReady);
        }

        static void Set(Text t, string s)
        {
            if (t != null && t.text != s) t.text = s;
        }
    }
}
