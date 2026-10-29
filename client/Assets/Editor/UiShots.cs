using System;
using System.IO;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// Renders the UI prefabs with sample data into PNGs, over the matching draft, so a layout can
    /// be checked without Play mode (also from batchmode on a copy of the project):
    ///   Unity -batchmode -projectPath client -executeMethod CollectionGame.EditorTools.UiShots.Capture
    ///         -shotOut /some/dir [-draftDir docs/gorsel/ui-taslaklar]
    /// Writes hud.png (alone), hud-over-draft.png (on hud3 at half strength) and the same for canta-v2.
    /// </summary>
    public static class UiShots
    {
        [MenuItem("CollectionGame/UI/Capture Shots")]
        public static void CaptureFromMenu() => Run(Path.GetFullPath("../ui-shots"), Path.GetFullPath("../docs/gorsel/ui-taslaklar"));

        public static void Capture()
        {
            var outDir = Arg("-shotOut") ?? Path.GetFullPath("../ui-shots");
            var drafts = Arg("-draftDir") ?? Path.GetFullPath("../docs/gorsel/ui-taslaklar");
            try
            {
                Run(outDir, drafts);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                EditorApplication.Exit(1);
            }
        }

        static void Run(string outDir, string drafts)
        {
            UiPrefabBuilder.Build();
            Directory.CreateDirectory(outDir);
            Shot(outDir, "hud", Path.Combine(drafts, "hud3.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
            });
            Shot(outDir, "canta", Path.Combine(drafts, "canta-v2.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                FillBag(Spawn<BagView>(canvas, "Bag"));
            });
            Shot(outDir, "menu", Path.Combine(drafts, "canta-v2.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                FillBag(Spawn<BagView>(canvas, "Bag"));
                var pop = Spawn<PopupView>(canvas, "Popup");
                pop.SendMessage("Awake", SendMessageOptions.DontRequireReceiver);
                pop.ShowMenu("Sazan · 3 adet", new (string, Action)[] { ("Deftere koy", () => { }), ("Kilitle", () => { }), ("Takasa ekle", null), ("Sat / Parçala (NPC yanında)", null) });
                ((RectTransform)pop.menu).anchoredPosition = new Vector2(1100, 360);
            });
            Shot(outDir, "gorev", Path.Combine(drafts, "npc-gorev.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<QuestView>(canvas, "Quests");
                v.coin.text = "1.240";
                v.diamond.text = "85";
                v.hint.text = "Yenilenmeye 9 sa 41 dk · seri 3 gün";
                (string, string, float, string)[] q = { ("5 balık tut", "balık", 1f, "5 / 5"), ("1 tane rare ya da üstü yakala", "balık", 0.33f, "1 / 3"), ("NPC'ye 5 şey sat", "sat", 0f, "0 / 5") };
                for (var i = 0; i < 3; i++)
                {
                    var r = v.quests[i];
                    r.icon.SetEmpty();
                    r.icon.label.text = q[i].Item2;
                    r.title.text = q[i].Item1;
                    v.SetBar(r, q[i].Item3);
                    r.count.text = q[i].Item4;
                    r.reward.text = "Ödül: günün sandığına sayılır";
                    r.state.text = i == 0 ? "Bitti" : "";
                }
                v.chest.icon.SetEmpty();
                v.chest.icon.label.text = "sandık";
                v.chest.title.text = "4. gün sandığı";
                v.SetBar(v.chest, 0.33f);
                v.chest.count.text = "1 / 3";
                v.chest.reward.text = "10. gün sandığı en iyisidir";
                v.chest.button.interactable = false;
            });
            Shot(outDir, "takas-a", Path.Combine(drafts, "takas-a.png"), canvas => FillTrade(canvas, false, false));
            Shot(outDir, "takas-b", Path.Combine(drafts, "takas-b.png"), canvas => FillTrade(canvas, false, true));
            Shot(outDir, "takas-c", Path.Combine(drafts, "takas-c.png"), canvas => FillTrade(canvas, true, false));
            Shot(outDir, "tezgah-kur", Path.Combine(drafts, "tezgah-kur.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<StallSetupView>(canvas, "StallSetup");
                v.title.text = "Taze sazan, ucuz!";
                v.stallHeader.text = "Tezgah · 5 / 12";
                (string, string, int, long)[] stall = { ("lake.fish.sazan", "", 10, 12), ("lake.fish.levrek", "rare", 1, 320), ("lake.mat.scale", "rare", 1, 250), ("lake.bait.worm", "", 20, 8), ("lake.fish.altin", "epic", 1, 850) };
                for (var i = 0; i < v.stall.Length; i++)
                {
                    if (i < stall.Length) v.stall[i].SetItem(stall[i].Item1, stall[i].Item2, stall[i].Item3, false);
                    else v.stall[i].SetEmpty();
                    v.tags[i].Set(i < stall.Length ? stall[i].Item4 : 0);
                }
                v.pickedName.text = "Tünek · 0.0870";
                v.pickedCondition.text = "Excellent";
                v.countLabel.gameObject.SetActive(false);
                v.count.gameObject.SetActive(false);
                v.price.text = "320";
                v.place.text = "Yer: Pazar alanı, 31 tezgah açık";
                v.recall.gameObject.SetActive(false);
                for (var i = 0; i < 20; i++)
                {
                    var s2 = UnityEngine.Object.Instantiate(v.bagTemplate, v.bagGrid, false);
                    s2.gameObject.SetActive(true);
                    if (i < 16) s2.SetItem(i % 2 == 0 ? "lake.fish.sazan" : "lake.junk.boot", i % 3 == 0 ? "rare" : "", 1, i == 10);
                    else s2.SetEmpty();
                }
            });
            Shot(outDir, "tezgah", Path.Combine(drafts, "tezgah-tezgah.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<StallListView>(canvas, "Stall");
                v.window.title.text = "Mert'in tezgahı";
                v.title.text = "\"Kristal var\"";
                v.owner.text = "Mert · pet satıyor";
                v.pet.SetEmpty();
                long[] prices = { 1900, 240, 300, 12, 800, 900, 15, 8, 260, 290, 2300, 14 };
                for (var i = 0; i < 12; i++)
                {
                    v.slots[i].SetItem(i % 4 == 3 ? "lake.fish.sazan" : "lake.gem.kristal", i % 4 == 3 ? "" : i % 2 == 0 ? "legendary" : "rare", i % 4 == 3 ? 10 : 1, false, i == 3);
                    v.tags[i].Set(prices[i]);
                }
                v.detailSlot.SetItem("lake.fish.sazan", "", 10, false);
                v.detailName.text = "Sazan";
                v.detailSub.text = "sıradan balık · 10 adet";
                v.unitPrice.text = "12";
                v.count.text = "3";
                v.total.text = "36";
                v.footer.text = "12 / 12 kalem · Coin Mert'e gider, çevrimdışı olsa da";
            });
            Shot(outDir, "pano", Path.Combine(drafts, "tezgah-pano.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<BoardView>(canvas, "Board");
                string[] titles = { "\"Kristal var\"", "\"Pristine Tünek burada\"", "\"Recipe satıyorum\"", "\"Taze sazan, ucuz!\"" };
                string[] owners = { "Mert'in tezgahı", "Ayse_k'in tezgahı", "derinci'in tezgahı", "Ece'in tezgahı" };
                long[][] prices = { new long[] { 1900, 2300, 240 }, new long[] { 900, 300, 15 }, new long[] { 900, 1100, 8 }, new long[] { 10, 12, 800 } };
                for (var i = 0; i < 4; i++)
                {
                    var c = v.cards[i];
                    c.pet.SetEmpty();
                    c.title.text = titles[i];
                    c.owner.text = owners[i];
                    for (var j = 0; j < 3; j++)
                    {
                        c.slots[j].SetItem("lake.fish.sazan", j == 0 ? "epic" : "rare", 1, false);
                        c.tags[j].Set(prices[i][j]);
                    }
                }
                v.empty.gameObject.SetActive(false);
            });
            Shot(outDir, "defter", Path.Combine(drafts, "defter-v2.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<BookView>(canvas, "Book");
                v.owner.text = "Defter";
                HudView.Fill(v.totalFill, 10f / 36f);
                v.totalText.text = "10 / 36";
                v.luck.text = "Şans +%3";
                v.score.text = "1.820";
                v.pages[0].title.text = "Göl Balıkları";
                v.pages[0].count.text = "7/12";
                v.pages[1].title.text = "Göl Balıkları";
                v.pages[1].count.text = "sayfa 2/2";
                string[] names = { "Gökkuşağı Alabalığı", "Sazan", "Göl Levreği", "Altın Balık", "Eski Çizme", "Yeşil Şişe", "Göl Levreği", "???", "Göl Kristali", "Paslı Kutu", "???", "???" };
                int[] state = { 2, 2, 2, 2, 1, 2, 2, 0, 1, 2, 0, 0 };
                int[] tier = { 0, 0, 1, 2, 0, 0, 1, 0, 0, 0, 0, 0 };
                for (var i = 0; i < 12; i++)
                {
                    var c = v.pages[i / 6].cards[i % 6];
                    c.frame.sprite = state[i] == 2 ? v.tierFrames[tier[i]] : state[i] == 1 ? v.found : v.unknown;
                    c.mark.text = state[i] == 0 ? "??" : names[i].Substring(0, 4).ToLowerInvariant();
                    c.name.text = names[i];
                    c.newBadge.SetActive(i == 2);
                }
                v.nav.text = "Göl Balıkları · Derin Su";
            });
            Shot(outDir, "profil", Path.Combine(drafts, "profil-v3.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<ProfileView>(canvas, "Profile");
                v.portrait.SetEmpty();
                v.portrait.label.text = "Ece";
                v.name.text = "Ece";
                v.level.text = "Lv 12";
                v.score.text = "2.340";
                v.huntText.text = "Arıyorum: Mağara Kristali";
                v.showcase[0].SetItem("lake.fish.altin", "epic", 1, false);
                v.showcase[1].SetItem("lake.gem.kristal", "legendary", 1, false);
                v.showcase[2].SetItem("lake.mat.scale", "rare", 1, false);
                v.stat1Label.text = "Tamamlanan sayfa";
                v.stat1Value.text = "1/3";
                HudView.Fill(v.stat1Fill, 0.33f);
                v.stat2Label.text = "Vitrin";
                v.stat2Value.text = "3/3";
                v.stat3Label.text = "Level";
                v.stat3Value.text = "12";
                v.footer.text = "";
            });
            Shot(outDir, "arkadaslar", Path.Combine(drafts, "arkadaslar-list.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<FriendsView>(canvas, "Friends");
                var ink = new Color32(0x45, 0x29, 0x3f, 255);
                var paper = new Color32(0xf2, 0xe8, 0xd0, 255);
                for (var i = 0; i < 3; i++)
                {
                    v.tabs[i].GetComponent<Image>().sprite = i == 0 ? v.tabOn : v.tabOff;
                    v.tabTexts[i].color = i == 0 ? ink : paper;
                }
                v.tabTexts[0].text = "Arkadaşlar 5";
                v.requestCount.text = "2";
                void Section(string t)
                {
                    var x = UnityEngine.Object.Instantiate(v.sectionTemplate, v.list, false);
                    x.gameObject.SetActive(true);
                    x.text = t;
                }
                void Row(string name, string sub, bool online)
                {
                    var r = UnityEngine.Object.Instantiate(v.rowTemplate, v.list, false);
                    r.gameObject.SetActive(true);
                    r.back.enabled = online;
                    r.avatar.SetEmpty();
                    r.avatar.label.text = name.Substring(0, 1);
                    r.dot.sprite = online ? v.dotOnline : v.dotOffline;
                    r.name.text = name;
                    r.sub.text = sub;
                    foreach (var b in new[] { r.no, r.yes, r.cancel, r.unblock }) b.gameObject.SetActive(false);
                    r.go.gameObject.SetActive(online);
                }
                Section("Çevrimiçi · 3");
                Row("Ece", "Liman", true);
                Row("Mert", "Liman", true);
                Row("Deniz", "Mercan", true);
                Section("Çevrimdışı · 2");
                Row("Kaan", "çevrimdışı", false);
                Row("Selin", "çevrimdışı", false);
                v.friendsOnly.isOn = true;
            });
            Shot(outDir, "ayarlar-genel", Path.Combine(drafts, "ayarlar-genel.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<SettingsView>(canvas, "Settings");
                SettingsTabs(v, true);
                v.music.value = 0.6f;
                v.musicValue.text = "%60";
                v.effects.value = 0.85f;
                v.effectsValue.text = "%85";
                v.hitSound.isOn = true;
                v.languageText.text = "Türkçe";
                v.uiScaleText.text = "2x (önerilen)";
                v.fullScreen.isOn = false;
                v.showNames.isOn = true;
                v.friendsOnly.isOn = false;
                v.announcements.isOn = true;
                v.bubbles.isOn = true;
                v.blocked.text = "Engellenenler: 2 kişi";
                v.version.text = "v0.4 · Liman";
            });
            Shot(outDir, "ayarlar-hesap", Path.Combine(drafts, "ayarlar-hesap.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<SettingsView>(canvas, "Settings");
                SettingsTabs(v, false);
                v.hidden.SetActive(false);
                Login(v.google, true, "✓ ece@gmail.com", "Kaldır", false);
                Login(v.facebook, false, "bağlı değil", "Bağla", true);
                Login(v.discord, false, "bağlı değil", "Bağla", true);
                Login(v.steam, false, "bağlı değil", "Kod üret", true);
                v.code.text = "KX7Q-4ZPM";
                v.codeTimer.text = "9:41 kaldı · tek kullanımlık";
                v.username.text = "Kullanıcı adı: Ece";
                v.version.text = "v0.4 · Liman";
            });
            Shot(outDir, "fisilti", Path.Combine(drafts, "hud3.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var w = Spawn<WhisperView>(canvas, "Whisper");
                w.window.title.text = "Mert";
                w.menuRow.gameObject.SetActive(true);
                w.log.text = "<color=#1e6f50><b>Mert:</b></color> kristal kaça?\n<b>Sen:</b> 1.900, tezgahta\n<color=#7f708a><i>Kişisel bilgi gizlendi</i></color>\n<color=#9e4539>Oyuncu çevrimiçi değil</color>";
                var w2 = Spawn<WhisperView>(canvas, "Whisper");
                w2.window.gameObject.SetActive(false);
                w2.strip.gameObject.SetActive(true);
                w2.stripText.text = "Ayse_k";
            });
            Debug.Log($"[UI] Shots written to {outDir}");
        }

        static T Spawn<T>(Canvas canvas, string name) where T : Component
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>($"Assets/Resources/UI/{name}.prefab");
            var go = (GameObject)UnityEngine.Object.Instantiate(prefab, canvas.transform, false);
            return go.GetComponent<T>();
        }

        static void FillTrade(Canvas canvas, bool bothLocked, bool askCount)
        {
            FillHud(Spawn<HudView>(canvas, "Hud"));
            var t = Spawn<TradeView>(canvas, "Trade");
            t.window.title.text = "Takas · Mert";
            void Side(TradeView.Side side, string name, string level, (string, string, int)[] items, string coin, bool locked)
            {
                side.name.text = name;
                side.level.text = level;
                side.back.sprite = locked ? t.locked : t.open;
                for (var i = 0; i < side.slots.Length; i++)
                    if (i < items.Length) side.slots[i].SetItem(items[i].Item1, items[i].Item2, items[i].Item3, false);
                    else side.slots[i].SetEmpty();
                side.count.text = $"{items.Length} / 8 eşya";
                side.coin.SetTextWithoutNotify(coin);
                side.status.text = locked ? "Kilitledi" : "Hazırlanıyor...";
                side.status.color = locked ? new Color32(0x7a, 0x30, 0x45, 255) : new Color(0.27f, 0.16f, 0.25f, 0.65f);
            }
            var mine = bothLocked
                ? new[] { ("lake.gem.kristal", "legendary", 1), ("lake.fish.sazan", "", 2), ("lake.junk.bottle", "", 2) }
                : new[] { ("lake.gem.kristal", "legendary", 1), ("lake.fish.sazan", "", 2) };
            Side(t.me, "Sen", "", mine, bothLocked ? "250" : "0", bothLocked);
            Side(t.them, "Mert", "Lv 12", new[] { ("lake.fish.altin", "epic", 1), ("lake.fish.tunek", "rare", 1), ("lake.mat.scale", "rare", 1) }, "1.500", true);
            t.strip.SetActive(bothLocked);
            t.hint.gameObject.SetActive(!bothLocked);
            t.stripText.text = "İki taraf kilitledi. Onay 3 sn sonra açılır: 2";
            t.lockText.text = bothLocked ? "Kilidi aç" : "Kilitle";
            t.confirm.interactable = false;
            t.confirmText.text = bothLocked ? "Onayla (2)" : "Onayla";
            if (askCount)
            {
                var c = Spawn<CountView>(canvas, "Count");
                c.question.text = "Kaç tane? (Sazan, 3 var)";
                c.dim.SetActive(true);
                c.value.text = "2";
            }
        }

        static void SettingsTabs(SettingsView v, bool general)
        {
            var ink = new Color32(0x45, 0x29, 0x3f, 255);
            var paper = new Color32(0xf2, 0xe8, 0xd0, 255);
            SettingsView.Tab(v.tabGeneral, general, v.tabOn, v.tabOff, paper, ink);
            SettingsView.Tab(v.tabAccount, !general, v.tabOn, v.tabOff, paper, ink);
            v.general.SetActive(general);
            v.account.SetActive(!general);
        }

        static void Login(SettingsView.LoginRow row, bool linked, string status, string button, bool enabled)
        {
            row.back.enabled = linked;
            row.status.text = status;
            row.status.color = linked ? new Color32(0x1e, 0x6f, 0x50, 255) : new Color(0.27f, 0.16f, 0.25f, 0.65f);
            row.buttonText.text = button;
            row.button.interactable = enabled;
        }

        static void FillHud(HudView h)
        {
            h.place.text = "Liman";
            h.info.text = "12 kişi görüşte";
            h.score.text = "1.820";
            h.coin.text = "1.240";
            h.diamond.text = "85";
            h.level.text = "Lv 7";
            HudView.Fill(h.xpFill, 0.62f);
            h.xpText.text = "XP 1.240 / 2.000";
            HudView.Fill(h.energyFill, 0.72f);
            h.energyText.text = "Enerji 72/100";
            HudView.Fill(h.rodFill, 0.18f);
            h.rodFillImage.sprite = h.rodLow;
            h.rodText.text = "Olta %18";
            h.bait.SetItem("lake.bait.worm", "", 12, false);
            h.baitText.text = "Yem";
            h.chatLog.text = "<color=#e6904e>Ece:</color> göl kenarı bugün çok kalabalık\n<color=#8fd3ff>Mert:</color> kristal setini bitirdin mi?\n<color=#f9c22b>Sistem:</color> Kaan bir Pristine Epic yakaladı!";
            h.questsAlert.SetActive(true);
        }

        static void FillBag(BagView b)
        {
            b.capacity.text = "23 / 40";
            b.balance.text = "1.240 Coin · 85 toz";
            string[] tiers = { "common", "rare", "", "epic", "", "legendary", "common", "mythic" };
            for (var i = 0; i < 40; i++)
            {
                var s = UnityEngine.Object.Instantiate(b.slotTemplate, b.grid, false);
                s.gameObject.SetActive(true);
                if (i < 23) s.SetItem(i % 3 == 0 ? "lake.fish.sazan" : i % 3 == 1 ? "lake.fish.levrek" : "lake.junk.boot", tiers[i % tiers.Length], i % 4 == 2 ? 4 : 1, i == 5);
                else s.SetEmpty();
            }
        }

        static void Shot(string outDir, string name, string draftPath, Action<Canvas> fill)
        {
            const int w = (int)UiRoot.RefWidth, h = (int)UiRoot.RefHeight;
            var rt = new RenderTexture(w, h, 24, RenderTextureFormat.ARGB32);
            var camGo = new GameObject("ShotCamera");
            var cam = camGo.AddComponent<Camera>();
            cam.orthographic = true;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.33f, 0.49f, 0.39f);
            cam.targetTexture = rt;
            cam.cullingMask = 1 << 5;

            var canvasGo = new GameObject("ShotCanvas", typeof(RectTransform));
            canvasGo.layer = 5;
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceCamera;
            canvas.worldCamera = cam;
            canvas.planeDistance = 1;
            canvas.pixelPerfect = true;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
            scaler.scaleFactor = 1;
            scaler.referencePixelsPerUnit = UiRoot.PixelsPerUnit;

            Texture2D draft = null;
            RawImage back = null;
            if (File.Exists(draftPath))
            {
                draft = new Texture2D(2, 2) { filterMode = FilterMode.Point };
                draft.LoadImage(File.ReadAllBytes(draftPath));
                var bg = new GameObject("Draft", typeof(RectTransform));
                bg.layer = 5;
                bg.transform.SetParent(canvasGo.transform, false);
                var brt = (RectTransform)bg.transform;
                brt.anchorMin = Vector2.zero;
                brt.anchorMax = Vector2.one;
                brt.offsetMin = brt.offsetMax = Vector2.zero;
                back = bg.AddComponent<RawImage>();
                back.texture = draft;
                back.enabled = false;
            }

            fill(canvas);
            Save(cam, rt, Path.Combine(outDir, name + ".png"));
            if (back != null)
            {
                back.enabled = true;
                back.color = new Color(1, 1, 1, 0.55f);
                back.transform.SetAsLastSibling(); // draft drawn over the UI, half strength
                Save(cam, rt, Path.Combine(outDir, name + "-over-draft.png"));
                back.color = Color.white;
                back.transform.SetAsFirstSibling();
                Save(cam, rt, Path.Combine(outDir, name + "-draft.png"));
            }

            UnityEngine.Object.DestroyImmediate(canvasGo);
            UnityEngine.Object.DestroyImmediate(camGo);
            if (draft != null) UnityEngine.Object.DestroyImmediate(draft);
            rt.Release();
        }

        static void Save(Camera cam, RenderTexture rt, string path)
        {
            Canvas.ForceUpdateCanvases();
            cam.Render();
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            File.WriteAllBytes(path, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
                if (args[i] == name) return args[i + 1];
            return null;
        }
    }
}
