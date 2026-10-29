using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
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
        string note;
        float noteUntil;
        Vector2 bookScroll;

        /// <summary>Sends a friend request (userId, username); set by the world.</summary>
        public Action<string, string> AddFriend { get; set; }
        /// <summary>(userId, name): sends a trade offer.</summary>
        public Action<string, string> OfferTrade { get; set; }
        /// <summary>(userId, name): opens a whisper window.</summary>
        public Action<string, string> Whisper { get; set; }

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
                discovered = e;
                discoveredUntil = Time.time + (e.book.pageComplete ? BigBannerSeconds : BannerSeconds);
                catchDirty = true;
                if (e.book.pageComplete) Toasts.Show($"Sayfa tamamlandı: {PageName(e.book.page)}!");
                Debug.Log($"[Book] discovered {e.defId} on {e.book.page}, complete {e.book.pageComplete}, luck {e.book.luck}, score {e.book.score}");
                if (MyProfile != null && e.book.score > 0) MyProfile.score = e.book.score;
                if (BookOpen && bookIsMine) Refresh();
            }
            else if (e.book.kind == BookKind.Copy && e.book.better && e.item != null && !string.IsNullOrEmpty(e.item.instanceId))
            {
                SwapOffer = e;
                catchDirty = true;
                if (Book == null) Refresh(); // the copy in the slot, for the comparison
                Debug.Log($"[Book] better copy of {e.defId}, asking to swap");
            }
        }

        public void OnBookResult(BookResultMsg r)
        {
            LastResult = r;
            Debug.Log($"[Book] BOOK_RESULT ok {r.ok} {r.reason} {r.defId} score {r.score}");
            if (r.ok)
            {
                ShowNote($"Deftere kondu: {FishingController.ItemName(r.defId)} (Score {r.score})");
                if (MyProfile != null && r.score > 0) MyProfile.score = r.score;
            }
            else ShowNote(r.reason == "NOT_OWNED" ? "Eşya çantanda değil" : $"Deftere konamadı ({r.reason})");
            if (BookOpen && bookIsMine) Refresh();
        }

        public void AcceptSwap()
        {
            if (SwapOffer == null) return;
            net.Send(OpCode.BookPlace, new BookPlaceMsg { instanceId = SwapOffer.item.instanceId });
            SwapOffer = null;
            catchDirty = true;
        }

        public void DeclineSwap()
        {
            SwapOffer = null;
            catchDirty = true;
        }

        // ---------- RPCs ----------

        public async void OpenBook(string userId, string ownerName)
        {
            bookIsMine = string.IsNullOrEmpty(userId) || userId == net.UserId;
            bookOwnerName = ownerName;
            BookOpen = true;
            Book = null;
            bookDirty = true;
            PageIndex = 0;
            try
            {
                Book = await net.GetBookAsync(bookIsMine ? null : userId);
                spread = 0;
                bookDirty = true;
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
            profileDirty = true;
            try
            {
                Profile = await net.GetProfileAsync(userId);
                profileDirty = true;
                if (Profile.userId == net.UserId) MyProfile = Profile;
            }
            catch (Exception ex)
            {
                ShowNote("Profil açılamadı");
                Debug.LogWarning($"[Book] get_profile failed: {ex.Message}");
            }
        }

        /// <summary>Own profile for the HUD score, without opening the card.</summary>
        public async void LoadMine()
        {
            try
            {
                MyProfile = await net.GetProfileAsync(null);
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Book] get_profile failed: {ex.Message}");
            }
        }

        /// <summary>The Collection Score as last heard from the server (profile, book results).</summary>
        public int Score => MyProfile?.score ?? 0;

        async void Refresh()
        {
            try
            {
                Book = await net.GetBookAsync();
                bookDirty = true;
                catchDirty = true;
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
                profileDirty = true;
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

        void ShowNote(string text)
        {
            note = text;
            noteUntil = Time.time + BannerSeconds;
        }

        // ---------- UI ----------

        /// <summary>Old IMGUI hook: notes are toasts, the banners and the swap question are uGUI (CatchView).</summary>
        public void DrawGui()
        {
            if (note != null && Time.time < noteUntil)
            {
                Toasts.Show(note);
                note = null;
            }
        }

        // ---------- uGUI: Resources/UI/Book (defter-v2), Resources/UI/Profile (profil-v3) ----------

        static readonly Color Ink = new Color32(0x45, 0x29, 0x3f, 255);
        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);
        const int SpreadSize = 12;

        BookView bookView;
        CatchView catchView;
        FishEndMsg discovered;
        float discoveredUntil;
        bool catchDirty;
        ProfileView profileView;
        bool bookDirty = true, profileDirty = true;
        int spread;
        /// <summary>Tooltip and menu shared by the windows (set by the world).</summary>
        public PopupView Popup { get; set; }

        public void Destroy()
        {
            if (bookView != null) UnityEngine.Object.Destroy(bookView.gameObject);
            if (profileView != null) UnityEngine.Object.Destroy(profileView.gameObject);
            if (catchView != null) UnityEngine.Object.Destroy(catchView.gameObject);
        }

        bool Ensure()
        {
            var ui = UiRoot.Get();
            if (bookView == null && (bookView = ui.Spawn<BookView>("Book")) != null) WireBook(bookView);
            if (profileView == null && (profileView = ui.Spawn<ProfileView>("Profile")) != null) WireProfile(profileView);
            if (catchView == null && (catchView = ui.Spawn<CatchView>("Catch")) != null)
            {
                catchView.discover.Open = false;
                catchView.swap.Open = false;
                catchView.swapYes.onClick.AddListener(AcceptSwap);
                catchView.swapNo.onClick.AddListener(DeclineSwap);
            }
            return bookView != null && profileView != null && catchView != null;
        }

        public void Tick()
        {
            if (!Ensure()) return;
            if (bookView.window.Open != BookOpen)
            {
                bookView.window.Open = BookOpen;
                bookDirty = true;
            }
            if (profileView.window.Open != ProfileOpen)
            {
                profileView.window.Open = ProfileOpen;
                profileDirty = true;
            }
            if (BookOpen && bookDirty) RedrawBook();
            if (ProfileOpen && profileDirty) RedrawProfile();
            TickCatch();
        }

        // ----- Defter -----

        void WireBook(BookView v)
        {
            v.window.Closed = () => BookOpen = false;
            v.window.Open = false;
            v.prev.onClick.AddListener(() => Turn(-1));
            v.next.onClick.AddListener(() => Turn(1));
            for (var p = 0; p < v.pages.Length; p++)
                for (var i = 0; i < v.pages[p].cards.Length; i++)
                {
                    var index = p * v.pages[p].cards.Length + i;
                    var hover = v.pages[p].cards[i].hover;
                    hover.Entered = () => HoverRecord(index);
                    hover.Exited = () => Popup?.HideTooltip();
                    hover.Clicked = hover.RightClicked = () => RecordMenu(index);
                }
        }

        BookRecord[] Records => Book?.pages != null && Book.pages.Length > 0 ? Book.pages[Mathf.Clamp(PageIndex, 0, Book.pages.Length - 1)].records ?? Array.Empty<BookRecord>() : Array.Empty<BookRecord>();
        int Spreads => Mathf.Max(1, Mathf.CeilToInt(Records.Length / (float)SpreadSize));

        void Turn(int step)
        {
            if (Book?.pages == null || Book.pages.Length == 0) return;
            spread += step;
            if (spread < 0)
            {
                PageIndex = (PageIndex - 1 + Book.pages.Length) % Book.pages.Length;
                spread = Spreads - 1;
            }
            else if (spread >= Spreads)
            {
                PageIndex = (PageIndex + 1) % Book.pages.Length;
                spread = 0;
            }
            bookDirty = true;
        }

        BookRecord RecordAt(int index)
        {
            var i = spread * SpreadSize + index;
            var recs = Records;
            return i < recs.Length ? recs[i] : null;
        }

        void RedrawBook()
        {
            bookDirty = false;
            var v = bookView;
            v.owner.text = bookIsMine ? "Defter" : $"{bookOwnerName} defteri";
            if (Book?.pages == null || Book.pages.Length == 0)
            {
                v.totalText.text = "...";
                foreach (var pg in v.pages)
                {
                    pg.title.text = "Yükleniyor...";
                    pg.count.text = "";
                    foreach (var c in pg.cards) SetCard(c, null);
                }
                return;
            }
            PageIndex = Mathf.Clamp(PageIndex, 0, Book.pages.Length - 1);
            spread = Mathf.Clamp(spread, 0, Spreads - 1);
            var found = Book.pages.Sum(p => p.found);
            var total = Book.pages.Sum(p => p.total);
            HudView.Fill(v.totalFill, total > 0 ? (float)found / total : 0f);
            v.totalText.text = $"{found} / {total}";
            v.luck.text = $"Şans +%{Book.luck * 100f:0.#}";
            v.score.text = Kit.Num(Book.score);
            var page = Book.pages[PageIndex];
            var name = PageName(page.id);
            v.pages[0].title.text = name;
            v.pages[0].count.text = $"{page.found}/{page.total}";
            v.pages[1].title.text = name;
            v.pages[1].count.text = $"sayfa {spread + 1}/{Spreads}";
            for (var p = 0; p < v.pages.Length; p++)
                for (var i = 0; i < v.pages[p].cards.Length; i++)
                    SetCard(v.pages[p].cards[i], RecordAt(p * v.pages[p].cards.Length + i), i + p * v.pages[p].cards.Length < Records.Length - spread * SpreadSize);
            var nextPage = Book.pages[(PageIndex + 1) % Book.pages.Length];
            v.nav.text = Book.pages.Length > 1 ? $"{name} · {PageName(nextPage.id)}" : name;
        }

        void SetCard(BookView.Card c, BookRecord rec, bool exists = true)
        {
            var v = bookView;
            c.frame.gameObject.SetActive(exists && rec != null);
            c.name.gameObject.SetActive(exists && rec != null);
            c.newBadge.SetActive(false);
            if (rec == null) return;
            switch (rec.state)
            {
                case RecordState.Filled:
                    var rank = Tiers.Rank(rec.item?.tier);
                    c.frame.sprite = rank >= 0 ? v.tierFrames[rank] : v.found;
                    c.mark.text = SlotView.Short(rec.defId);
                    c.mark.color = Ink;
                    c.name.text = FishingController.ItemName(rec.defId);
                    c.name.color = Ink;
                    break;
                case RecordState.Found:
                    c.frame.sprite = v.found;
                    c.mark.text = SlotView.Short(rec.defId);
                    c.mark.color = Faint;
                    c.name.text = FishingController.ItemName(rec.defId);
                    c.name.color = Faint;
                    break;
                default:
                    c.frame.sprite = v.unknown;
                    c.mark.text = "??";
                    c.mark.color = new Color32(0x9b, 0xab, 0xb2, 255);
                    c.name.text = "???";
                    c.name.color = Faint;
                    break;
            }
        }

        void HoverRecord(int index)
        {
            var rec = RecordAt(index);
            if (Popup == null || rec == null || rec.state == RecordState.Unknown) return;
            var name = FishingController.ItemName(rec.defId);
            if (rec.state == RecordState.Found)
            {
                Popup.ShowTooltip($"<b>{name}</b>\nBulundu, yuva boş{(bookIsMine ? "\nTıkla: seçenekler" : "")}");
                return;
            }
            var it = rec.item;
            var actions = bookIsMine ? "\n<color=#f9c22b>Vitrine koy</color>   <color=#e83b3b>Arıyorum</color>\nTıkla: seçenekler" : "";
            Popup.ShowTooltip($"<b>{name}</b>\n{it?.tier}\nFloat {it?.@float:0.0000}{actions}");
        }

        void RecordMenu(int index)
        {
            var rec = RecordAt(index);
            if (Popup == null || rec == null || !bookIsMine || rec.state == RecordState.Unknown) return;
            var showcase = ShowcaseIds();
            var entries = new List<(string, Action)>();
            if (rec.state == RecordState.Filled)
            {
                var inShowcase = showcase.Contains(rec.defId);
                entries.Add((inShowcase ? "Vitrinden al" : "Vitrine koy", () =>
                    SetShowcase(inShowcase ? showcase.Where(d => d != rec.defId).ToArray() : showcase.Append(rec.defId).ToArray())));
            }
            var hunting = MyProfile?.hunting == rec.defId;
            entries.Add((hunting ? "Aramayı bırak" : "Arıyorum", () => SetHunting(hunting ? null : rec.defId)));
            Popup.ShowMenu(FishingController.ItemName(rec.defId), entries);
        }

        // ----- Yeni keşif / Daha temiz kopya (balik-kesif, balik-temiz) -----

        void TickCatch()
        {
            var v = catchView;
            var showDiscover = discovered != null && Time.time < discoveredUntil;
            if (v.discover.Open != showDiscover) v.discover.Open = showDiscover;
            if (v.swap.Open != (SwapOffer != null)) v.swap.Open = SwapOffer != null;
            if (!catchDirty) return;
            catchDirty = false;
            if (discovered != null)
            {
                var it = discovered.item;
                v.discover.title.text = discovered.book.pageComplete ? "Sayfa tamamlandı!" : "Yeni keşif!";
                v.discoverSlot.SetItem(discovered.defId, it?.tier, 1, false);
                v.discoverName.text = FishingController.ItemName(discovered.defId);
                v.discoverTier.text = it?.tier ?? "";
                v.discoverFloat.text = it != null ? $"Float {it.@float:0.0000}" : "";
                var page = Book?.pages?.FirstOrDefault(p => p.id == discovered.book.page);
                v.discoverPage.text = page != null ? $"{PageName(page.id)} {Mathf.Min(page.total, page.found + 1)} / {page.total}" : PageName(discovered.book.page);
                HudView.Fill(v.discoverFill, page != null && page.total > 0 ? Mathf.Min(1f, (page.found + 1f) / page.total) : 0f);
            }
            if (SwapOffer != null)
            {
                var it = SwapOffer.item;
                var old = Book?.pages?.SelectMany(p => p.records ?? Array.Empty<BookRecord>()).FirstOrDefault(r => r.defId == it.defId)?.item;
                v.newSlot.SetItem(it.defId, it.tier, 1, false);
                v.newFloat.text = $"{it.@float:0.0000}";
                v.newCondition.text = "";
                if (old != null)
                {
                    v.oldSlot.SetItem(old.defId, old.tier, 1, false);
                    v.oldFloat.text = $"{old.@float:0.0000}";
                }
                else
                {
                    v.oldSlot.SetEmpty();
                    v.oldFloat.text = "?";
                }
                v.oldCondition.text = "";
                v.swapCaption.text = $"{FishingController.ItemName(it.defId)} · {it.tier} · eski kopya çantaya düşer";
            }
        }

        // ----- Profil -----

        void WireProfile(ProfileView v)
        {
            v.window.Closed = () => ProfileOpen = false;
            v.window.Open = false;
            v.book.onClick.AddListener(() =>
            {
                if (Profile == null) return;
                var mine = Profile.userId == net.UserId;
                OpenBook(mine ? null : Profile.userId, Profile.username);
            });
            v.whisper.onClick.AddListener(() => { if (Profile != null) Whisper?.Invoke(Profile.userId, Profile.username); });
            v.friend.onClick.AddListener(() => { if (Profile != null) AddFriend?.Invoke(Profile.userId, Profile.username); });
            v.trade.onClick.AddListener(() => { if (Profile != null) OfferTrade?.Invoke(Profile.userId, Profile.username); });
            v.report.onClick.AddListener(ReportMenu);
            v.block.onClick.AddListener(BlockProfile);
            for (var i = 0; i < v.showcase.Length; i++)
            {
                v.showcase[i].Hovered = s =>
                {
                    if (Popup != null && s.Data is ItemInstance it)
                        Popup.ShowTooltip($"<b>{FishingController.ItemName(it.defId)}</b>\n{it.tier}\nFloat {it.@float:0.0000}");
                };
                v.showcase[i].Left = _ => Popup?.HideTooltip();
            }
        }

        static readonly (string id, string label)[] ReportReasons =
        {
            ("spam", "Spam"), ("abuse", "Hakaret"), ("scam", "Dolandırıcılık"),
            ("personal_info", "Kişisel bilgi"), ("cheating", "Hile"), ("other", "Diğer"),
        };

        void ReportMenu()
        {
            if (Popup == null || Profile == null || Profile.userId == net.UserId) return;
            var who = Profile.userId;
            Popup.ShowMenu("Raporla: neden?", ReportReasons.Select(r => (r.label, (Action)(() => Report(who, r.id)))));
        }

        async void Report(string userId, string reason)
        {
            try
            {
                await net.ReportAsync(userId, reason, null, null);
                Toasts.Show("Raporun alındı. Teşekkürler.");
            }
            catch (Exception e)
            {
                Toasts.Show(Connection.ErrorOf(e) == ErrorCode.RateLimited ? "Çok fazla rapor gönderdin, sonra tekrar dene" : "Rapor gönderilemedi", true);
            }
        }

        async void BlockProfile()
        {
            if (Profile == null || Profile.userId == net.UserId) return;
            var name = Profile.username;
            try
            {
                await net.BlockAsync(Profile.userId);
                Toasts.Show($"{name} engellendi");
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Book] block failed: {e.Message}");
                Toasts.Show("Engellenemedi", true);
            }
        }

        void RedrawProfile()
        {
            profileDirty = false;
            var v = profileView;
            var p = Profile;
            v.portrait.SetEmpty();
            v.portrait.label.text = p != null ? p.username : "";
            if (p == null)
            {
                v.name.text = "Yükleniyor...";
                v.levelTag.SetActive(false);
                v.hunt.SetActive(false);
                return;
            }
            var mine = p.userId == net.UserId;
            v.name.text = p.username;
            v.levelTag.SetActive(true);
            v.level.text = $"Lv {Mathf.Max(1, p.level)}";
            v.sub.text = "";
            v.score.text = Kit.Num(p.score);
            v.hunt.SetActive(!string.IsNullOrEmpty(p.hunting));
            v.huntText.text = $"Arıyorum: {FishingController.ItemName(p.hunting)}";
            var show = p.showcase ?? Array.Empty<ItemInstance>();
            for (var i = 0; i < v.showcase.Length; i++)
            {
                var it = i < show.Length ? show[i] : null;
                if (it == null) v.showcase[i].SetEmpty();
                else v.showcase[i].SetItem(it.defId, it.tier, 1, false);
                v.showcase[i].Data = it;
            }
            var pages = p.pagesComplete?.Length ?? 0;
            v.stat1Label.text = "Tamamlanan sayfa";
            v.stat1Value.text = $"{pages}/{PageNames.Count}";
            HudView.Fill(v.stat1Fill, PageNames.Count > 0 ? (float)pages / PageNames.Count : 0f);
            v.stat2Label.text = "Vitrin";
            v.stat2Value.text = $"{show.Length}/{ShowcaseMax}";
            v.stat3Label.text = "Level";
            v.stat3Value.text = Mathf.Max(1, p.level).ToString();
            v.bookText.text = mine ? "Defterimi aç (K)" : "Defterine bak";
            v.whisper.gameObject.SetActive(!mine);
            v.friend.gameObject.SetActive(!mine);
            v.trade.gameObject.SetActive(!mine);
            v.report.gameObject.SetActive(!mine);
            v.block.gameObject.SetActive(!mine);
            v.footer.text = mine ? "Vitrin ve Arıyorum defterden seçilir (K)" : "";
        }
    }
}
