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
            if (tab == Tab.Account) LoadDeletion();
        }

        // ---------- RPCs ----------

        async void LoadPm()
        {
            try
            {
                PmOff = await net.WhisperSettingsAsync(null);
                dirty = true;
                pmLoaded = true;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Settings] whisper_settings failed: {e.Message}");
            }
        }

        async void SetPm(bool off)
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

        // ---------- UI (uGUI: Resources/UI/Settings, a PanelView) ----------

        PanelView view;
        bool dirty = true;
        Text codeLine;
        UnityEngine.UI.Button deleteButton;

        PanelView View
        {
            get
            {
                if (view != null) return view;
                view = UiRoot.Get().Spawn<PanelView>("Settings");
                if (view != null)
                {
                    view.window.Closed = Close;
                    view.Open = false;
                }
                return view;
            }
        }

        public void Destroy()
        {
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
        }

        void Changed() => dirty = true;

        public void Tick()
        {
            var v = View;
            if (v == null) return;
            if (v.Open != Open)
            {
                v.Open = Open;
                dirty = true;
            }
            if (!Open) return;
            if (dirty) Redraw(v);
            if (codeLine != null && code != null)
            {
                var left = code.expiresInMs / 1000f - (Time.time - codeAt);
                codeLine.text = left > 0f
                    ? $"Steam'de bu kodu yaz:  <b>{code.code}</b>   ({(int)left / 60}:{(int)left % 60:00} kaldı · tek kullanımlık)"
                    : "Kodun süresi doldu, yenisini üret.";
            }
        }

        void Redraw(PanelView v)
        {
            dirty = false;
            codeLine = null;
            deleteButton = null;
            v.ClearRows();
            v.ClearFooter();
            v.Tabs(new[] { "Genel", "Hesap" }, (int)Current, i =>
            {
                Select((Tab)i);
                dirty = true;
            });
            v.header.text = Current == Tab.General ? "Sohbet" : "Hesap";
            v.headerRight.text = net.Username;
            v.footer.text = error ?? "";
            if (Current == Tab.General) DrawGeneral(v);
            else if (!revealed) DrawHidden(v);
            else DrawAccount(v);
        }

        void DrawGeneral(PanelView v)
        {
            var row = v.Row().Title("PM kapalı").Sub("Açıkken sadece arkadaşların sana fısıldayabilir. Yabancılar zaten sadece tezgahın açıkken yazabilir.");
            row.Button(PmOff ? "Açık" : "Kapalı", PmOff ? "green" : "wood", pmLoaded && !busy ? () => SetPm(!PmOff) : (Action)null, 80);
            v.Line("Fısıltı: sohbete /w Ad mesaj yaz, ya da bir oyuncunun kartında Fısılda'ya bas.");
        }

        void DrawHidden(PanelView v)
        {
            v.Row().Title("Hesap bilgilerin gizlendi")
                .Sub("Yayın yapıyorsan ya da yanında biri varsa açma. Bu sayfada hesabını taşıyan kod ve silme ayarı var.")
                .Button("Göster", "wood", () =>
                {
                    revealed = true;
                    dirty = true;
                }, 90);
        }

        void DrawAccount(PanelView v)
        {
            v.Line("Giriş yöntemleri: Google, Facebook ve Discord bağlama yakında. Hepsi aynı karaktere girer.");
            v.Row().Title("Steam").Sub("Steam'de bu hesapla oynamak için kod üret").Button("Kod üret", "green", busy ? (Action)null : MakeCode, 90);
            if (code != null)
            {
                codeLine = v.Line("", 0, false);
                codeLine.supportRichText = true;
                v.Line("Bu kodu kimseyle paylaşma. Yetkililer asla istemez.").color = new Color(0.62f, 0.27f, 0.22f);
            }

            v.Line($"Kullanıcı adı: {net.Username}  (değişmez)", 0, false);
            if (Deletion == null)
            {
                v.Line("Yükleniyor...");
                return;
            }
            if (Deletion.pending)
            {
                v.Row().Title($"Hesabın {When(Deletion.runAt)} tarihinde silinecek.")
                    .Sub("O tarihten önce tekrar giriş yaparsan silme iptal olur.")
                    .Button("Silmeyi iptal et", "green", busy ? (Action)null : CancelDeletion, 140);
                return;
            }
            if (!confirmDelete)
            {
                v.Row().Title("Hesabı sil").Sub("Silme hemen olmaz: bir süre bekler, bu sürede geri alınır.")
                    .Button("Hesabı sil", "red", () =>
                    {
                        confirmDelete = true;
                        dirty = true;
                    }, 110);
                return;
            }
            var row = v.Row().Title("Karakterin, defterin, eşyaların, Coin'in ve bu hesaptaki kozmetikler kalıcı olarak gider.")
                .Sub("Silinen hesabın adı ve giriş yolları bir süre yeni hesap açamaz. Onaylamak için kullanıcı adını aynen yaz:");
            row.Input(typedName, 130, t =>
            {
                typedName = t;
                if (deleteButton != null) deleteButton.interactable = !busy && typedName == net.Username;
            }, 32, false);
            v.FooterButton("Vazgeç", "wood", () =>
            {
                confirmDelete = false;
                typedName = "";
                dirty = true;
            });
            v.FooterSpace();
            deleteButton = v.FooterButton("Hesabımı sil", "red", RequestDeletion, 140);
            deleteButton.interactable = !busy && typedName == net.Username;
        }
    }
}
