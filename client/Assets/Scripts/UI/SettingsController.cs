using System;
using System.Globalization;
using CollectionGame.Net;
using UnityEngine;

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
        readonly KitWindow window = new KitWindow("Ayarlar", 520, 380);

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
            window.Center();
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
                pmLoaded = true;
            }
            catch (Exception e)
            {
                error = Connection.ErrorOf(e) == ErrorCode.RateLimited ? "Biraz bekle, sonra tekrar dene" : "Ayar kaydedilemedi";
            }
            busy = false;
        }

        async void LoadDeletion()
        {
            try
            {
                Deletion = await net.RpcAsync<AccountDeleteStatus>("account_delete_status", null);
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
        }

        static string When(long ms) =>
            DateTimeOffset.FromUnixTimeMilliseconds(ms).ToLocalTime().ToString("d MMMM yyyy HH:mm", CultureInfo.GetCultureInfo("tr-TR"));

        /// <summary>Notification 104: logging in again cancelled a pending deletion.</summary>
        public void OnDeletionCancelled()
        {
            Deletion = new AccountDeleteStatus();
            Toasts.Show("Tekrar giriş yaptığın için hesap silme iptal edildi");
        }

        // ---------- UI ----------

        public void DrawGui()
        {
            if (!Open) return;
            if (!window.Begin())
            {
                window.End();
                Close();
                return;
            }
            GUILayout.BeginHorizontal();
            GUILayout.BeginVertical(GUILayout.Width(110));
            if (GUILayout.Button("Genel", Current == Tab.General ? Kit.TabOn : Kit.Tab, GUILayout.Height(24))) Select(Tab.General);
            if (GUILayout.Button("Hesap", Current == Tab.Account ? Kit.TabOn : Kit.Tab, GUILayout.Height(24))) Select(Tab.Account);
            GUILayout.FlexibleSpace();
            GUILayout.Label(net.Username, Kit.Faint);
            GUILayout.EndVertical();
            GUILayout.Space(10);
            GUILayout.BeginVertical();
            if (Current == Tab.General) DrawGeneral();
            else if (!revealed) DrawHidden();
            else DrawAccount();
            if (!string.IsNullOrEmpty(error)) GUILayout.Label(error, Kit.Warn);
            GUILayout.EndVertical();
            GUILayout.EndHorizontal();
            window.End();
        }

        void DrawGeneral()
        {
            GUILayout.Label("Sohbet", Kit.Header);
            GUILayout.BeginHorizontal(Kit.Card);
            GUILayout.BeginVertical();
            GUILayout.Label("PM kapalı", Kit.Bold);
            GUILayout.Label("Açıkken sadece arkadaşların sana fısıldayabilir. Yabancılar zaten sadece tezgahın açıkken yazabilir.", Kit.Faint);
            GUILayout.EndVertical();
            GUI.enabled = pmLoaded && !busy;
            if (GUILayout.Button(PmOff ? "Açık" : "Kapalı", PmOff ? Kit.Green : Kit.Wood, GUILayout.Width(70), GUILayout.Height(24))) SetPm(!PmOff);
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            GUILayout.Space(6);
            GUILayout.Label("Fısıltı: sohbete /w Ad mesaj yaz, ya da bir oyuncunun kartında Fısılda'ya bas.", Kit.Faint);
        }

        void DrawHidden()
        {
            GUILayout.FlexibleSpace();
            GUILayout.BeginVertical(Kit.Dark);
            GUILayout.Label("Hesap bilgilerin gizlendi", Kit.Light);
            var small = new GUIStyle(Kit.Small);
            small.normal.textColor = Kit.Light.normal.textColor;
            GUILayout.Label("Yayın yapıyorsan ya da yanında biri varsa açma. Bu sayfada hesabını taşıyan kod ve silme ayarı var.", small);
            if (GUILayout.Button("Göster", Kit.Wood, GUILayout.Width(100), GUILayout.Height(24))) revealed = true;
            GUILayout.EndVertical();
            GUILayout.FlexibleSpace();
        }

        void DrawAccount()
        {
            GUILayout.Label("Giriş yöntemleri", Kit.Header);
            GUILayout.Label("Google, Facebook ve Discord bağlama yakında. Hepsi aynı karaktere girer.", Kit.Faint);
            GUILayout.BeginHorizontal(Kit.Card);
            GUILayout.Label("Steam", Kit.Bold, GUILayout.Width(60));
            GUILayout.Label("Steam'de bu hesapla oynamak için kod üret", Kit.Small);
            GUI.enabled = !busy;
            if (GUILayout.Button("Kod üret", Kit.Green, GUILayout.Width(80), GUILayout.Height(22))) MakeCode();
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            if (code != null)
            {
                var left = code.expiresInMs / 1000f - (Time.time - codeAt);
                GUILayout.BeginVertical(Kit.Dark);
                if (left > 0f)
                {
                    GUILayout.Label($"Steam'de bu kodu yaz:  {code.code}    ({(int)left / 60}:{(int)left % 60:00} kaldı · tek kullanımlık)", Kit.Light);
                }
                else GUILayout.Label("Kodun süresi doldu, yenisini üret.", Kit.Light);
                var warn = new GUIStyle(Kit.Small);
                warn.normal.textColor = new Color(1f, 0.6f, 0.55f);
                GUILayout.Label("Bu kodu kimseyle paylaşma. Yetkililer asla istemez.", warn);
                GUILayout.EndVertical();
            }

            GUILayout.Space(8);
            GUILayout.Label("Hesap", Kit.Header);
            GUILayout.Label($"Kullanıcı adı: {net.Username}  (değişmez)", Kit.Text);
            if (Deletion == null)
            {
                GUILayout.Label("Yükleniyor...", Kit.Faint);
                return;
            }
            if (Deletion.pending)
            {
                GUILayout.BeginVertical(Kit.Card);
                GUILayout.Label($"Hesabın {When(Deletion.runAt)} tarihinde silinecek.", Kit.Warn);
                GUILayout.Label("O tarihten önce tekrar giriş yaparsan silme iptal olur.", Kit.Faint);
                GUI.enabled = !busy;
                if (GUILayout.Button("Silmeyi iptal et", Kit.Green, GUILayout.Width(150), GUILayout.Height(24))) CancelDeletion();
                GUI.enabled = true;
                GUILayout.EndVertical();
                return;
            }
            if (!confirmDelete)
            {
                GUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("Hesabı sil", Kit.Red, GUILayout.Width(130), GUILayout.Height(24))) confirmDelete = true;
                GUILayout.EndHorizontal();
                GUILayout.Label("Silme hemen olmaz: bir süre bekler, bu sürede geri alınır.", Kit.Faint);
                return;
            }
            GUILayout.BeginVertical(Kit.Card);
            GUILayout.Label("Karakterin, defterin, eşyaların, Coin'in ve bu hesaptaki kozmetikler kalıcı olarak gider. Silinen hesabın adı ve giriş yolları bir süre yeni hesap açamaz.", Kit.Warn);
            GUILayout.Label("Onaylamak için kullanıcı adını aynen yaz:", Kit.Small);
            typedName = GUILayout.TextField(typedName, 32, Kit.Input, GUILayout.Height(22));
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Vazgeç", Kit.Wood, GUILayout.Height(24)))
            {
                confirmDelete = false;
                typedName = "";
            }
            GUI.enabled = !busy && typedName == net.Username;
            if (GUILayout.Button("Hesabımı sil", Kit.Red, GUILayout.Height(24))) RequestDeletion();
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            GUILayout.EndVertical();
        }
    }
}
