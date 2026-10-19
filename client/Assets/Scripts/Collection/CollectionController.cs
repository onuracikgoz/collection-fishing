using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.Collection
{
    /// <summary>
    /// Phase 3 on the client (docs/protokol.md, Collection Book; docs/tasarim/06-defter.md):
    /// the Collection Book window (own or anyone's), the "Yeni keşif!" banner, the
    /// "Defterdekiyle değiştir?" prompt (BOOK_PLACE) and profile cards with showcase
    /// and "Arıyorum". Records, luck and score all come from the server. Placeholder UI.
    ///
    /// Keys: K opens your book, P your profile card. Click a name above a player
    /// to see their card.
    /// </summary>
    public sealed class CollectionController
    {
        public const int ShowcaseMax = 3; // server PROFILE config (Öneri); the server checks it

        const float BannerSeconds = 4f;
        const float BigBannerSeconds = 6f;

        // Display names for the placeholder pages (server/src/data/book-pages.ts, 06-defter.md 8.2).
        static readonly Dictionary<string, string> PageNames = new Dictionary<string, string>
        {
            ["lake_fish"] = "Göl Balıkları",
            ["deep_water"] = "Derin Su",
            ["treasures"] = "Hazineler",
        };

        readonly Connection net;

        public BookResponse Book { get; private set; }
        public ProfileResponse Profile { get; private set; }
        public bool BookOpen { get; set; }
        public bool ProfileOpen { get; set; }
        public int PageIndex { get; set; }
        /// <summary>Own profile, kept to know the current showcase and hunting.</summary>
        public ProfileResponse MyProfile { get; private set; }
        public BookResultMsg LastResult { get; private set; }
        /// <summary>A cleaner copy waiting for the player's answer.</summary>
        public FishEndMsg SwapOffer { get; private set; }

        string bookOwnerName;
        bool bookIsMine = true;
        string banner;
        bool bannerBig;
        float bannerUntil;
        string note;
        float noteUntil;
        Vector2 bookScroll;

        public CollectionController(Connection net) => this.net = net;

        public static string PageName(string id) => id != null && PageNames.TryGetValue(id, out var n) ? n : id ?? "?";

        // ---------- input ----------

        public void Update(bool chatOpen)
        {
            var k = Keyboard.current;
            if (chatOpen || k == null) return;
            if (k.kKey.wasPressedThisFrame)
            {
                if (BookOpen && bookIsMine) BookOpen = false;
                else OpenBook(null, net.Username);
            }
            if (k.pKey.wasPressedThisFrame)
            {
                if (ProfileOpen && Profile != null && Profile.userId == net.UserId) ProfileOpen = false;
                else OpenProfile(null);
            }
        }

        // ---------- server ----------

        /// <summary>Own FISH_END with a book outcome.</summary>
        public void OnFishEnd(FishEndMsg e)
        {
            if (e.outcome != FishOutcome.Caught || e.book == null || string.IsNullOrEmpty(e.book.page)) return;
            var name = FishingController.ItemName(e.defId);
            if (e.book.kind == BookKind.Discovered)
            {
                if (e.book.pageComplete) ShowBanner($"Sayfa tamamlandı: {PageName(e.book.page)}!  ({name})", true);
                else ShowBanner($"Yeni keşif! {name} · {PageName(e.book.page)}", false);
                Debug.Log($"[Book] discovered {e.defId} on {e.book.page}, complete {e.book.pageComplete}, luck {e.book.luck}, score {e.book.score}");
                if (BookOpen && bookIsMine) Refresh();
            }
            else if (e.book.kind == BookKind.Copy && e.book.better && e.item != null && !string.IsNullOrEmpty(e.item.instanceId))
            {
                SwapOffer = e;
                Debug.Log($"[Book] better copy of {e.defId}, asking to swap");
            }
        }

        public void OnBookResult(BookResultMsg r)
        {
            LastResult = r;
            Debug.Log($"[Book] BOOK_RESULT ok {r.ok} {r.reason} {r.defId} score {r.score}");
            if (r.ok) ShowNote($"Deftere kondu: {FishingController.ItemName(r.defId)} (Score {r.score})");
            else ShowNote(r.reason == "NOT_OWNED" ? "Eşya çantanda değil" : $"Deftere konamadı ({r.reason})");
            if (BookOpen && bookIsMine) Refresh();
        }

        public void AcceptSwap()
        {
            if (SwapOffer == null) return;
            net.Send(OpCode.BookPlace, new BookPlaceMsg { instanceId = SwapOffer.item.instanceId });
            SwapOffer = null;
        }

        public void DeclineSwap() => SwapOffer = null;

        // ---------- RPCs ----------

        public async void OpenBook(string userId, string ownerName)
        {
            bookIsMine = string.IsNullOrEmpty(userId) || userId == net.UserId;
            bookOwnerName = ownerName;
            BookOpen = true;
            Book = null;
            PageIndex = 0;
            try
            {
                Book = await net.GetBookAsync(bookIsMine ? null : userId);
                if (bookIsMine && MyProfile == null) MyProfile = await net.GetProfileAsync();
            }
            catch (Exception ex)
            {
                ShowNote("Defter açılamadı");
                Debug.LogWarning($"[Book] get_book failed: {ex.Message}");
            }
        }

        public async void OpenProfile(string userId)
        {
            ProfileOpen = true;
            Profile = null;
            try
            {
                Profile = await net.GetProfileAsync(userId);
                if (Profile.userId == net.UserId) MyProfile = Profile;
            }
            catch (Exception ex)
            {
                ShowNote("Profil açılamadı");
                Debug.LogWarning($"[Book] get_profile failed: {ex.Message}");
            }
        }

        async void Refresh()
        {
            try
            {
                Book = await net.GetBookAsync();
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Book] get_book failed: {ex.Message}");
            }
        }

        public async void SetShowcase(string[] defIds) => await SetProfile(defIds, null, false);

        public async void SetHunting(string defId) => await SetProfile(null, defId, defId == null);

        async System.Threading.Tasks.Task SetProfile(string[] showcase, string hunting, bool clear)
        {
            try
            {
                MyProfile = await net.SetProfileAsync(showcase, hunting, clear);
                if (Profile != null && Profile.userId == MyProfile.userId) Profile = MyProfile;
                ShowNote("Profil güncellendi");
            }
            catch (Exception ex)
            {
                var msg = ex.GetBaseException().Message ?? "";
                ShowNote(msg.Contains("TOO_MANY") ? $"Vitrinde en fazla {ShowcaseMax} eşya olur"
                    : msg.Contains("SLOT_EMPTY") ? "Vitrine sadece yuvası dolu eşya konur"
                    : "Profil güncellenemedi");
                Debug.LogWarning($"[Book] set_profile failed: {msg}");
            }
        }

        string[] ShowcaseIds() => MyProfile?.showcase?.Select(i => i.defId).ToArray() ?? Array.Empty<string>();

        void ShowBanner(string text, bool big)
        {
            banner = text;
            bannerBig = big;
            bannerUntil = Time.time + (big ? BigBannerSeconds : BannerSeconds);
        }

        void ShowNote(string text)
        {
            note = text;
            noteUntil = Time.time + BannerSeconds;
        }

        // ---------- UI ----------

        public void DrawGui()
        {
            if (banner != null && Time.time < bannerUntil)
            {
                var style = bannerBig ? Gui.Celebrate : Gui.Discover;
                var size = style.CalcSize(new GUIContent(banner)) + new Vector2(16f, 4f);
                GUI.Box(new Rect((Gui.Width - size.x) / 2f, 100, size.x, size.y), banner, style);
            }
            if (note != null && Time.time < noteUntil)
            {
                var size = Gui.Toast.CalcSize(new GUIContent(note)) + new Vector2(24f, 12f);
                GUI.Box(new Rect((Gui.Width - size.x) / 2f, Gui.Height - 110, size.x, size.y), note, Gui.Toast);
            }
            if (SwapOffer != null) DrawSwap();
            if (BookOpen) DrawBook();
            if (ProfileOpen) DrawProfile();
        }

        void DrawSwap()
        {
            var r = new Rect((Gui.Width - 340) / 2f, Gui.Height / 2f - 60, 340, 110);
            Gui.Block(r);
            GUILayout.BeginArea(r, Gui.Window);
            var it = SwapOffer.item;
            GUILayout.Label($"Daha temiz bir {FishingController.ItemName(it.defId)} (Float {it.@float:0.0000}). Defterdekiyle değiştir?", Gui.Hud);
            GUILayout.FlexibleSpace();
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Değiştir", Gui.Button, GUILayout.Height(30))) AcceptSwap();
            if (GUILayout.Button("Hayır", Gui.Button, GUILayout.Height(30))) DeclineSwap();
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        void DrawBook()
        {
            var r = new Rect(20, 60, Mathf.Min(560, Gui.Width - 40), Mathf.Min(460, Gui.Height - 120));
            Gui.Block(r);
            GUILayout.BeginArea(r, Gui.Window);
            GUILayout.BeginHorizontal();
            GUILayout.Label(bookIsMine ? "Defterim" : $"{bookOwnerName} defteri", Gui.Header);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Kapat", Gui.Button, GUILayout.Width(70))) BookOpen = false;
            GUILayout.EndHorizontal();

            if (Book == null || Book.pages == null)
            {
                GUILayout.Label("Yükleniyor...", Gui.Hud);
                GUILayout.EndArea();
                return;
            }

            GUILayout.Label($"Collection Score {Book.score} · Şans +%{Book.luck * 100f:0.#}", Gui.Hud);
            GUILayout.BeginHorizontal();
            for (var i = 0; i < Book.pages.Length; i++)
            {
                var p = Book.pages[i];
                var label = $"{PageName(p.id)} {p.found}/{p.total}";
                if (GUILayout.Toggle(i == PageIndex, label, Gui.Button)) PageIndex = i;
            }
            GUILayout.EndHorizontal();
            GUILayout.Space(6);

            PageIndex = Mathf.Clamp(PageIndex, 0, Book.pages.Length - 1);
            var page = Book.pages[PageIndex];
            var showcase = ShowcaseIds();
            bookScroll = GUILayout.BeginScrollView(bookScroll);
            foreach (var rec in page.records ?? Array.Empty<BookRecord>())
            {
                GUILayout.BeginHorizontal(GUI.skin.box);
                if (rec.state == RecordState.Unknown)
                {
                    GUILayout.Label("??", Gui.Faint, GUILayout.Width(150));
                    GUILayout.Label("henüz bulunmadı", Gui.Faint);
                }
                else if (rec.state == RecordState.Found)
                {
                    GUILayout.Label(FishingController.ItemName(rec.defId), Gui.Faint, GUILayout.Width(150));
                    GUILayout.Label("bulundu, yuva boş", Gui.Faint);
                }
                else
                {
                    GUILayout.Label(FishingController.ItemName(rec.defId), Gui.Hud, GUILayout.Width(150));
                    GUILayout.Label(rec.item != null ? $"{rec.item.tier} · Float {rec.item.@float:0.0000}" : "", Gui.Hud);
                }
                GUILayout.FlexibleSpace();
                if (bookIsMine && rec.state != RecordState.Unknown) DrawRecordButtons(rec, showcase);
                GUILayout.EndHorizontal();
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        void DrawRecordButtons(BookRecord rec, string[] showcase)
        {
            if (rec.state == RecordState.Filled)
            {
                var inShowcase = showcase.Contains(rec.defId);
                if (GUILayout.Button(inShowcase ? "Vitrinden al" : "Vitrine koy", Gui.Button, GUILayout.Width(110)))
                {
                    var next = inShowcase ? showcase.Where(d => d != rec.defId).ToArray() : showcase.Append(rec.defId).ToArray();
                    SetShowcase(next);
                }
            }
            var hunting = MyProfile?.hunting == rec.defId;
            if (GUILayout.Button(hunting ? "Aramayı bırak" : "Arıyorum", Gui.Button, GUILayout.Width(110)))
                SetHunting(hunting ? null : rec.defId);
        }

        void DrawProfile()
        {
            var r = new Rect(Gui.Width - 340, 60, 320, 240);
            Gui.Block(r);
            GUILayout.BeginArea(r, Gui.Window);
            GUILayout.BeginHorizontal();
            GUILayout.Label(Profile == null ? "Profil" : Profile.username, Gui.Header);
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Kapat", Gui.Button, GUILayout.Width(70))) ProfileOpen = false;
            GUILayout.EndHorizontal();

            if (Profile == null)
            {
                GUILayout.Label("Yükleniyor...", Gui.Hud);
                GUILayout.EndArea();
                return;
            }

            GUILayout.Label($"Collection Score: {Profile.score}", Gui.Hud);
            var pages = Profile.pagesComplete != null && Profile.pagesComplete.Length > 0
                ? string.Join(", ", Profile.pagesComplete.Select(PageName))
                : "yok";
            GUILayout.Label($"Tamamlanan sayfalar: {pages}", Gui.Hud);
            GUILayout.Space(6);
            GUILayout.Label("Vitrin", Gui.Header);
            if (Profile.showcase == null || Profile.showcase.Length == 0) GUILayout.Label("boş", Gui.Faint);
            else
                foreach (var it in Profile.showcase)
                    GUILayout.Label($"{FishingController.ItemName(it.defId)} · {it.tier} · Float {it.@float:0.0000}", Gui.Hud);
            GUILayout.Space(6);
            GUILayout.Label($"Arıyorum: {(string.IsNullOrEmpty(Profile.hunting) ? "-" : FishingController.ItemName(Profile.hunting))}", Gui.Hud);
            GUILayout.FlexibleSpace();
            var mine = Profile.userId == net.UserId;
            if (GUILayout.Button(mine ? "Defterimi aç (K)" : "Defterini gör", Gui.Button, GUILayout.Height(28)))
                OpenBook(mine ? null : Profile.userId, Profile.username);
            GUILayout.EndArea();
        }
    }
}
