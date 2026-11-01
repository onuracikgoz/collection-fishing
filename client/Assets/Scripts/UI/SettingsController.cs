using System;
using System.Globalization;
using CollectionGame.Net;
using CollectionGame.UI.Views;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.UI
{
    /// <summary>
    /// Settings window (drafts ayarlar-genel, ayarlar-hesap). Genel: "PM kapalı" (whisper_settings).
    /// Hesap: opens blurred until the warning is accepted (streams, shoulder surfing), then the
    /// Steam transfer code (transfer_code_create) and account deletion (account_delete_*, two steps:
    /// the player types the username). Linking Google / Facebook / Discord comes in Faz 7.
    /// </summary>
    public sealed class SettingsController
    {
        public enum Tab { General, Account }

        readonly Connection net;

        public bool Open { get; private set; }
        public Tab Current { get; private set; }
        public bool PmOff { get; private set; }
        public AccountDeleteStatus Deletion { get; private set; }

        public bool PmLoaded => pmLoaded;
        bool pmLoading;
        float pmFailedAt = -100f;
        /// <summary>Not loaded yet and not just failed (so callers may poll it).</summary>
        public bool PmNeedsLoad => !pmLoaded && !pmLoading && Time.time - pmFailedAt > 10f;
        bool pmLoaded, busy, revealed, confirmDelete;
        string typedName = "";
        TransferCodeResponse code;
        float codeAt;
        string error;

        public SettingsController(Connection net) => this.net = net;

        public void Show(Tab tab = Tab.General)
        {
            Open = true;
            Select(tab);
            if (!pmLoaded) LoadPm();
        }

        public void Toggle()
        {
            if (Open) Close();
            else Show(Current);
        }

        void Close()
        {
            Open = false;
            HideLanguages();
            revealed = false;
            confirmDelete = false;
            typedName = "";
            code = null;
            GUIUtility.keyboardControl = 0;
        }

        void Select(Tab tab)
        {
            dirty = true;
            HideLanguages();
            Current = tab;
            error = null;
            // The account page opens hidden every time.
            revealed = false;
            confirmDelete = false;
            if (tab == Tab.Account)
            {
                LoadDeletion();
                logins = null;
            }
        }

        // ---------- RPCs ----------

        /// <summary>Reads "PM kapalı" once (the friends window shows it too).</summary>
        public async void LoadPm()
        {
            if (pmLoading) return;
            pmLoading = true;
            try
            {
                PmOff = await net.WhisperSettingsAsync(null);
                dirty = true;
                pmLoaded = true;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Settings] whisper_settings failed: {e.Message}");
                pmFailedAt = Time.time;
            }
            pmLoading = false;
        }

        public async void SetPm(bool off)
        {
            busy = true;
            try
            {
                PmOff = await net.WhisperSettingsAsync(off);
                dirty = true;
                pmLoaded = true;
            }
            catch (Exception e)
            {
                error = Loc.T(Connection.ErrorOf(e) == ErrorCode.RateLimited ? "common.wait_retry" : "settings.err.save_failed");
            }
            busy = false;
            dirty = true;
        }

        async void LoadDeletion()
        {
            try
            {
                Deletion = await net.RpcAsync<AccountDeleteStatus>("account_delete_status", null);
                dirty = true;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Settings] account_delete_status failed: {e.Message}");
            }
        }

        async void RequestDeletion()
        {
            busy = true;
            error = null;
            try
            {
                var r = await net.RpcAsync<AccountDeleteStatus>("account_delete_request", new AccountDeleteRequest { name = typedName });
                Deletion = new AccountDeleteStatus { pending = r.runAt > 0, runAt = r.runAt };
                confirmDelete = false;
                typedName = "";
                Toasts.Show(Loc.T("settings.delete_scheduled", ("date", When(r.runAt))));
            }
            catch (Exception e)
            {
                var c = Connection.ErrorOf(e);
                error = Loc.T(c == ErrorCode.BadRequest ? "settings.err.name_mismatch"
                    : c == ErrorCode.RateLimited ? "settings.err.too_many_tries"
                    : "settings.err.delete_failed");
            }
            busy = false;
            dirty = true;
        }

        async void CancelDeletion()
        {
            busy = true;
            error = null;
            try
            {
                await net.RpcAsync<AccountDeleteStatus>("account_delete_cancel", null);
                Deletion = new AccountDeleteStatus();
                Toasts.Show(Loc.T("settings.delete_cancelled"));
            }
            catch (Exception e)
            {
                error = Loc.T(Connection.ErrorOf(e) == ErrorCode.RateLimited ? "settings.err.too_many_tries" : "settings.err.cancel_failed");
            }
            busy = false;
            dirty = true;
        }

        async void MakeCode()
        {
            busy = true;
            error = null;
            try
            {
                code = await net.RpcAsync<TransferCodeResponse>("transfer_code_create", null);
                codeAt = Time.time;
            }
            catch (Exception e)
            {
                error = Loc.T(Connection.ErrorOf(e) == ErrorCode.RateLimited ? "settings.err.too_many_codes" : "settings.err.code_failed");
            }
            busy = false;
            dirty = true;
        }

        static string When(long ms) =>
            DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime().ToString("d MMMM yyyy HH:mm", Loc.Culture);

        /// <summary>Notification 104: logging in again cancelled a pending deletion.</summary>
        public void OnDeletionCancelled()
        {
            Deletion = new AccountDeleteStatus();
            dirty = true;
            Toasts.Show(Loc.T("settings.delete_cancelled_login"));
        }

        // ---------- UI (uGUI: Resources/UI/Settings, drafts ayarlar-genel / ayarlar-hesap) ----------

        static readonly Color Ink = new Color32(0x45, 0x29, 0x3f, 255);
        static readonly Color Paper = new Color32(0xf2, 0xe8, 0xd0, 255);
        static readonly Color Linked = new Color32(0x1e, 0x6f, 0x50, 255);
        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);

        SettingsView view;
        bool dirty = true;
        Connection.Logins? logins;
        bool loadingLogins;

        /// <summary>Count of blocked players for the Genel page, and opening the list.</summary>
        public Func<int> BlockedCount { get; set; }
        public Action OpenBlocked { get; set; }
        /// <summary>Çıkış yap: leave the server.</summary>
        public Action Logout { get; set; }

        SettingsView View
        {
            get
            {
                if (view != null) return view;
                view = UiRoot.Get().Spawn<SettingsView>("Settings");
                if (view == null) return null;
                Wire(view);
                view.window.Open = false;
                return view;
            }
        }

        void Wire(SettingsView v)
        {
            v.window.Closed = Close;
            v.tabGeneral.button.onClick.AddListener(() => Select(Tab.General));
            v.tabAccount.button.onClick.AddListener(() => Select(Tab.Account));
            v.version.text = $"v{Application.version}";

            v.music.SetValueWithoutNotify(ClientSettings.Music);
            v.effects.SetValueWithoutNotify(ClientSettings.Effects);
            v.music.onValueChanged.AddListener(x =>
            {
                ClientSettings.Music = x;
                v.musicValue.text = $"%{Mathf.RoundToInt(x * 100)}";
            });
            v.effects.onValueChanged.AddListener(x =>
            {
                ClientSettings.Effects = x;
                v.effectsValue.text = $"%{Mathf.RoundToInt(x * 100)}";
            });
            v.musicValue.text = $"%{Mathf.RoundToInt(ClientSettings.Music * 100)}";
            v.effectsValue.text = $"%{Mathf.RoundToInt(ClientSettings.Effects * 100)}";

            Bind(v.hitSound, () => ClientSettings.HitSound, x => ClientSettings.HitSound = x);
            Bind(v.fullScreen, () => Screen.fullScreen, x => Screen.fullScreen = x);
            Bind(v.showNames, () => ClientSettings.ShowNames, x => ClientSettings.ShowNames = x);
            Bind(v.announcements, () => ClientSettings.Announcements, x => ClientSettings.Announcements = x);
            Bind(v.bubbles, () => ClientSettings.Bubbles, x => ClientSettings.Bubbles = x);
            v.friendsOnly.onValueChanged.AddListener(x =>
            {
                if (pmLoaded && x != PmOff) SetPm(x);
            });

            // Language: a list under the field; untranslated languages are greyed out (Locales/languages.json).
            v.languageText.text = LanguageName(Loc.Current);
            v.language.onClick.AddListener(() =>
            {
                if (v.languageList == null) return;
                var show = !v.languageList.activeSelf;
                if (show) FillLanguages(v);
                v.languageList.SetActive(show);
            });
            if (v.languageList != null) v.languageList.SetActive(false);
            v.uiScale.onClick.AddListener(() =>
            {
                ClientSettings.UiScale = (ClientSettings.UiScale + 1) % 4;
                dirty = true;
            });
            v.openBlocked.onClick.AddListener(() => OpenBlocked?.Invoke());

            v.reveal.onClick.AddListener(() =>
            {
                revealed = true;
                dirty = true;
            });
            v.steam.button.onClick.AddListener(MakeCode);
            v.logout.onClick.AddListener(() =>
            {
                Close();
                Logout?.Invoke();
            });
            v.delete.onClick.AddListener(() =>
            {
                confirmDelete = true;
                dirty = true;
            });
            v.confirmCancel.onClick.AddListener(() =>
            {
                confirmDelete = false;
                typedName = "";
                dirty = true;
            });
            v.confirmName.onValueChanged.AddListener(t =>
            {
                typedName = t;
                v.confirmDelete.interactable = !busy && typedName == net.Username;
            });
            v.confirmDelete.onClick.AddListener(RequestDeletion);
            v.cancelDeletion.onClick.AddListener(CancelDeletion);
        }

        int locVersion;

        void HideLanguages()
        {
            if (view != null && view.languageList != null) view.languageList.SetActive(false);
        }

        /// <summary>One row per language from the template row; only translated (enabled) ones can be picked.</summary>
        void FillLanguages(SettingsView v)
        {
            if (v.languageRow == null) return;
            var parent = v.languageRow.transform.parent;
            for (var i = parent.childCount - 1; i >= 0; i--)
            {
                var child = parent.GetChild(i);
                if (child != v.languageRow.transform) UnityEngine.Object.Destroy(child.gameObject);
            }
            v.languageRow.gameObject.SetActive(false);
            foreach (var l in Loc.Languages)
            {
                var row = UnityEngine.Object.Instantiate(v.languageRow, parent);
                row.gameObject.SetActive(true);
                row.name = "Language " + l.code;
                var name = LanguageName(l);
                var text = row.GetComponentInChildren<Text>();
                if (text != null)
                {
                    text.text = l.code == Loc.Lang ? $"✓ {name}" : l.enabled ? name : Loc.T("settings.language_soon", ("name", name));
                    text.color = l.enabled ? Ink : Faint;
                }
                row.interactable = l.enabled;
                var code = l.code;
                row.onClick.AddListener(() =>
                {
                    HideLanguages();
                    Loc.SetLanguage(code);
                });
            }
        }

        /// <summary>The language's own name, or its English name when the game font lacks its letters (ru, zh, ja, ko).</summary>
        static string LanguageName(Loc.Language l)
        {
            var f = GameFont.Get();
            if (f == null || string.IsNullOrEmpty(l.name)) return l.english;
            f.RequestCharactersInTexture(l.name);
            foreach (var c in l.name)
                if (!char.IsWhiteSpace(c) && !f.HasCharacter(c)) return l.english;
            return l.name;
        }

        static void Bind(Toggle t, Func<bool> get, Action<bool> set)
        {
            t.SetIsOnWithoutNotify(get());
            t.onValueChanged.AddListener(x => set(x));
        }

        public void Destroy()
        {
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
        }

        public void Tick()
        {
            var v = View;
            if (v == null) return;
            if (v.window.Open != Open)
            {
                v.window.Open = Open;
                dirty = true;
            }
            if (!Open) return;
            if (locVersion != Loc.Version)
            {
                locVersion = Loc.Version; // language changed: redraw the texts
                dirty = true;
            }
            if (dirty && !UiRoot.Typing) Redraw(v);
            if (code != null && v.codeBox.activeSelf)
            {
                var left = code.expiresInMs / 1000f - (Time.time - codeAt);
                var text = left > 0f ? Loc.T("settings.code_left", ("time", $"{(int)left / 60}:{(int)left % 60:00}")) : Loc.T("settings.code_expired");
                if (v.codeTimer.text != text) v.codeTimer.text = text;
            }
        }

        void Redraw(SettingsView v)
        {
            dirty = false;
            var general = Current == Tab.General;
            v.tabGeneral.Set(general);
            v.tabAccount.Set(!general);
            v.general.SetActive(general);
            v.account.SetActive(!general);
            if (general)
            {
                v.friendsOnly.SetIsOnWithoutNotify(PmOff);
                v.friendsOnly.interactable = pmLoaded && !busy;
                v.fullScreen.SetIsOnWithoutNotify(Screen.fullScreen);
                v.uiScaleText.text = ClientSettings.UiScaleName(ClientSettings.UiScale);
                v.languageText.text = LanguageName(Loc.Current);
                v.blocked.text = Loc.T("settings.blocked_count", ("count", BlockedCount?.Invoke() ?? 0));
                return;
            }

            v.hidden.SetActive(!revealed);
            v.accountContent.SetActive(revealed);
            if (!logins.HasValue && !loadingLogins) LoadLogins();
            var l = logins;
            Login(v.google, l?.Google ?? false, l?.Google == true ? $"✓ {l?.Email}" : null);
            Login(v.facebook, l?.Facebook ?? false, null);
            Login(v.discord, l?.Custom ?? false, null);
            // Steam links only with a code from here (protokol.md, Taşıma kodu).
            v.steam.back.enabled = l?.Steam ?? false;
            v.steam.status.text = Loc.T(l?.Steam == true ? "settings.linked" : "settings.not_linked");
            v.steam.status.color = l?.Steam == true ? Linked : Faint;
            v.steam.button.interactable = !busy && l?.Steam != true;
            v.steam.buttonText.text = Loc.T("settings.make_code");
            v.codeBox.SetActive(code != null);
            if (code != null) v.code.text = code.code;
            v.username.text = Loc.T("settings.username", ("name", net.Username));
            v.error.text = error ?? "";

            var pending = Deletion != null && Deletion.pending;
            v.pending.gameObject.SetActive(pending);
            v.cancelDeletion.gameObject.SetActive(pending);
            v.cancelDeletion.interactable = !busy;
            if (pending) v.pending.text = Loc.T("settings.delete_pending", ("date", When(Deletion.runAt)));
            v.confirm.SetActive(!pending && confirmDelete);
            var buttons = !pending && !confirmDelete;
            v.logout.gameObject.SetActive(!pending && !confirmDelete);
            v.delete.gameObject.SetActive(buttons);
            v.deleteNote.gameObject.SetActive(buttons);
            if (confirmDelete)
            {
                v.confirmName.SetTextWithoutNotify(typedName);
                v.confirmDelete.interactable = !busy && typedName == net.Username;
            }
        }

        /// <summary>Google / Facebook / Discord: linking from the game comes in Faz 7 (button shown, off).</summary>
        static void Login(SettingsView.LoginRow row, bool linked, string status)
        {
            row.back.enabled = linked;
            row.status.text = linked ? status ?? Loc.T("settings.linked") : Loc.T("settings.not_linked");
            row.status.color = linked ? Linked : Faint;
            row.buttonText.text = Loc.T(linked ? "settings.unlink" : "settings.link");
            row.button.interactable = false;
        }

        async void LoadLogins()
        {
            loadingLogins = true;
            try
            {
                logins = await net.GetLoginsAsync();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Settings] account failed: {e.Message}");
            }
            loadingLogins = false;
            dirty = true;
        }
    }
}
