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
            revealed = false;
            confirmDelete = false;
            typedName = "";
            code = null;
            GUIUtility.keyboardControl = 0;
        }

        void Select(Tab tab)
        {
            dirty = true;
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
                error = Connection.ErrorOf(e) == ErrorCode.RateLimited ? "Biraz bekle, sonra tekrar dene" : "Ayar kaydedilemedi";
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
                Toasts.Show($"Hesabın {When(r.runAt)} tarihinde silinecek");
            }
            catch (Exception e)
            {
                var c = Connection.ErrorOf(e);
                error = c == ErrorCode.BadRequest ? "Kullanıcı adı eşleşmedi: büyük/küçük harfiyle aynen yaz"
                    : c == ErrorCode.RateLimited ? "Çok fazla deneme, biraz bekle"
                    : "Silme isteği gönderilemedi";
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
                Toasts.Show("Hesap silme iptal edildi");
            }
            catch (Exception e)
            {
                error = Connection.ErrorOf(e) == ErrorCode.RateLimited ? "Çok fazla deneme, biraz bekle" : "İptal edilemedi";
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
                error = Connection.ErrorOf(e) == ErrorCode.RateLimited ? "Bu saat çok kod ürettin, sonra tekrar dene" : "Kod üretilemedi";
            }
            busy = false;
            dirty = true;
        }

        static string When(long ms) =>
            DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime().ToString("d MMMM yyyy HH:mm", CultureInfo.GetCultureInfo("tr-TR"));

        /// <summary>Notification 104: logging in again cancelled a pending deletion.</summary>
        public void OnDeletionCancelled()
        {
            Deletion = new AccountDeleteStatus();
            dirty = true;
            Toasts.Show("Tekrar giriş yaptığın için hesap silme iptal edildi");
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
            v.tabGeneral.onClick.AddListener(() => Select(Tab.General));
            v.tabAccount.onClick.AddListener(() => Select(Tab.Account));
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

            v.languageText.text = "Türkçe";
            v.language.interactable = false; // one language for now
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
            if (dirty && !UiRoot.Typing) Redraw(v);
            if (code != null && v.codeBox.activeSelf)
            {
                var left = code.expiresInMs / 1000f - (Time.time - codeAt);
                var text = left > 0f ? $"{(int)left / 60}:{(int)left % 60:00} kaldı · tek kullanımlık" : "Süresi doldu, yenisini üret";
                if (v.codeTimer.text != text) v.codeTimer.text = text;
            }
        }

        void Redraw(SettingsView v)
        {
            dirty = false;
            var general = Current == Tab.General;
            SettingsView.Tab(v.tabGeneral, general, v.tabOn, v.tabOff, Paper, Ink);
            SettingsView.Tab(v.tabAccount, !general, v.tabOn, v.tabOff, Paper, Ink);
            v.general.SetActive(general);
            v.account.SetActive(!general);
            if (general)
            {
                v.friendsOnly.SetIsOnWithoutNotify(PmOff);
                v.friendsOnly.interactable = pmLoaded && !busy;
                v.fullScreen.SetIsOnWithoutNotify(Screen.fullScreen);
                v.uiScaleText.text = ClientSettings.UiScaleName(ClientSettings.UiScale);
                v.blocked.text = $"Engellenenler: {BlockedCount?.Invoke() ?? 0} kişi";
                return;
            }

            v.hidden.SetActive(!revealed);
            if (!logins.HasValue && !loadingLogins) LoadLogins();
            var l = logins;
            Login(v.google, l?.Google ?? false, l?.Google == true ? $"✓ {l?.Email}" : null);
            Login(v.facebook, l?.Facebook ?? false, null);
            Login(v.discord, l?.Custom ?? false, null);
            // Steam links only with a code from here (protokol.md, Taşıma kodu).
            v.steam.back.enabled = l?.Steam ?? false;
            v.steam.status.text = l?.Steam == true ? "✓ bağlı" : "bağlı değil";
            v.steam.status.color = l?.Steam == true ? Linked : Faint;
            v.steam.button.interactable = !busy && l?.Steam != true;
            v.steam.buttonText.text = "Kod üret";
            v.codeBox.SetActive(code != null);
            if (code != null) v.code.text = code.code;
            v.username.text = $"Kullanıcı adı: {net.Username}";
            v.error.text = error ?? "";

            var pending = Deletion != null && Deletion.pending;
            v.pending.gameObject.SetActive(pending);
            v.cancelDeletion.gameObject.SetActive(pending);
            v.cancelDeletion.interactable = !busy;
            if (pending) v.pending.text = $"Hesabın {When(Deletion.runAt)} tarihinde silinecek. O tarihten önce tekrar girersen silme iptal olur.";
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
            row.status.text = linked ? status ?? "✓ bağlı" : "bağlı değil";
            row.status.color = linked ? Linked : Faint;
            row.buttonText.text = linked ? "Kaldır" : "Bağla";
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
