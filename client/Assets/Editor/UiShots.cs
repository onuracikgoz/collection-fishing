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
                var p = Spawn<PanelView>(canvas, "Quests");
                p.header.text = "Bugünün görevleri";
                p.headerRight.text = "Yenilenmeye 9 sa 41 dk";
                p.Row().Title("5 balık tut").Right("5 / 5").Bar(1f);
                p.Row().Title("1 tane rare ya da üstü yakala").Right("0 / 1").Bar(0f);
                p.Row().Title("NPC'ye 5 şey sat").Right("2 / 5").Bar(0.4f);
                p.footer.text = "Seri: 3 gün · bugünün sandığı 4. gün sandığı (10. gün en iyisi).";
                p.FooterSpace();
                p.FooterButton("2 / 3 bitti", "green", null, 160);
            });
            Shot(outDir, "takas-a", Path.Combine(drafts, "takas-a.png"), canvas => FillTrade(canvas, false, false));
            Shot(outDir, "takas-b", Path.Combine(drafts, "takas-b.png"), canvas => FillTrade(canvas, false, true));
            Shot(outDir, "takas-c", Path.Combine(drafts, "takas-c.png"), canvas => FillTrade(canvas, true, false));
            Shot(outDir, "tezgah-kur", Path.Combine(drafts, "tezgah-kur.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var p = Spawn<PanelView>(canvas, "Market");
                p.Tabs(new[] { "Tezgahım", "Pazar Panosu (4)" }, 0, _ => { });
                p.header.text = "Tezgah kur";
                p.headerRight.text = "1.240 Coin · 85 elmas";
                p.Row().Title("Başlık").Input("Taze sazan, ucuz!", 300, null, 40, false);
                p.Line("Satmak istediğine fiyat yaz (yığında adet başı). Kilitli eşya konamaz.");
                var a1 = p.Row().Mark("lake.fish.tunek", "rare").Title("tunek").Sub("rare · Excellent · Float 0.0870");
                a1.Input("320", 90, null);
                a1.Note("Coin");
                p.Row().Mark("lake.fish.levrek", "common", 1, true).Title("levrek").Sub("common · Temiz · Float 0.2100").Note("kilitli");
                var a2 = p.Row().Mark("lake.mat.scale", "", 20).Title("scale").Sub("çantada 20");
                a2.Note("adet");
                a2.Input("10", 50, null, 6);
                a2.Note("tanesi");
                a2.Input("12", 80, null);
                p.footer.text = "Pet sen oyundan çıkana kadar satar; satıştan pazar ücreti kesilir, satılmayanlar çantana döner.";
                p.FooterSpace();
                p.FooterButton("Tezgahı aç", "green", () => { }, 140);
            });
            Shot(outDir, "pano", Path.Combine(drafts, "tezgah-pano.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var p = Spawn<PanelView>(canvas, "Market");
                p.Tabs(new[] { "Tezgahım", "Pazar Panosu (4)" }, 1, _ => { });
                p.header.text = "İlanlar (eskiden yeniye)";
                p.headerRight.text = "1.240 Coin · 85 elmas";
                p.Row().Mark("lake.gem.kristal", "epic").Title("\"Kristal var\"").Sub("Mert tezgahı · 12 kalem   kristal (epic) 1.900   kristal (epic) 2.300").Button("Yanına git", "green", () => { }, 100);
                p.Row().Mark("lake.fish.tunek", "rare").Title("\"Pristine Tünek burada\"").Sub("Ayse_k tezgahı · 5 kalem   tunek (rare) 900   tunek (rare) 300").Button("Yanına git", "green", () => { }, 100);
                p.Row().Title("Panoya ilan ver").Sub("Elmasla ödenir, tezgah kapanınca ilan da kalkar. Elmasın: 85").Button("Reklam ver", "wood", () => { }, 100);
                p.footer.text = "İlan eşya miktarını ya da kalitesini değiştirmez. Alım ilanı yok.";
            });
            Shot(outDir, "tezgah", Path.Combine(drafts, "tezgah-tezgah.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var p = Spawn<PanelView>(canvas, "Stall");
                p.window.title.text = "Mert tezgahı";
                p.header.text = "\"Kristal var\"  ·  Mert";
                p.headerRight.text = "Coin'in: 1.240";
                p.Row().Mark("lake.gem.kristal", "epic").Title("kristal").Sub("epic · Pristine · Float 0.0412").Right("1.900 Coin").Button("Satın al", "green", null, 100);
                var r = p.Row().Mark("lake.fish.sazan", "", 10).Title("sazan").Sub("10 adet · tanesi 12 Coin");
                r.Button("-", "wood", () => { }, 22);
                r.Note("3");
                r.Button("+", "wood", () => { }, 22);
                r.Button("max", "wood", () => { }, 40);
                r.Button("Emin misin?", "green", () => { }, 100);
                p.footer.text = "Coin Mert'e gider, çevrimdışı olsa da. Float'lı eşyada Float ve kondisyon yazar.";
                p.FooterButton("Profil", "wood", () => { }, 80);
                p.FooterButton("Fısılda", "wood", () => { }, 80);
                p.FooterButton("Arkadaş ekle", "green", () => { }, 110);
                p.FooterSpace();
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
