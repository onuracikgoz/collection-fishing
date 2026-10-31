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
            Shot(outDir, "hud-sohbet-buyuk", Path.Combine(drafts, "hud3.png"), canvas =>
            {
                var h = Spawn<HudView>(canvas, "Hud");
                FillHud(h);
                h.chatLogBox.sizeDelta = new Vector2(h.chatLogBox.sizeDelta.x, 300);
                h.chatSizeText.text = "-";
            });
            Shot(outDir, "hud-sohbet-kapali", Path.Combine(drafts, "hud3.png"), canvas =>
            {
                var h = Spawn<HudView>(canvas, "Hud");
                FillHud(h);
                h.chatLogBox.gameObject.SetActive(false);
                h.chatOpen.gameObject.SetActive(true);
            });
            Shot(outDir, "baloncuk", Path.Combine(drafts, "hud3.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var prefab = Resources.Load<GameObject>("UI/Bubble");
                string[] says = { "Bugün 2 Rare çıktı!", "Kristal setini bitirdin mi?", "1 tane kaldı, Mythic :(" };
                var y = 0f;
                for (var i = says.Length - 1; i >= 0; i--)
                {
                    var b = UnityEngine.Object.Instantiate(prefab, canvas.transform, false).GetComponent<BubbleView>();
                    b.Set(says[i]);
                    b.tail.SetActive(i == says.Length - 1);
                    b.rect.anchoredPosition = new Vector2(700, 400 + y);
                    y += b.rect.sizeDelta.y + 4;
                }
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
                pop.ShowMenu("Göl Levreği", "rare", CollectionGame.UI.ItemText.TierColour("rare"), new (string, Action)[] { ("Deftere koy", () => { }), ("Kilitle", () => { }), ("Takasa ekle", null), ("Çöpe at", () => { }) });
                ((RectTransform)pop.menu).anchoredPosition = new Vector2(1100, 360);
            });
            Shot(outDir, "tooltip", Path.Combine(drafts, "canta-v2.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                FillBag(Spawn<BagView>(canvas, "Bag"));
                var pop = Spawn<PopupView>(canvas, "Popup");
                pop.SendMessage("Awake", SendMessageOptions.DontRequireReceiver);
                var it = new CollectionGame.Net.ItemInstance { defId = "lake.fish.perch", tier = "rare", @float = 0.0821f };
                pop.ShowTooltip(CollectionGame.UI.ItemText.Card(it, null, "Tıkla: işlemler · Sürükle: taşı", ("Kondisyon", "Excellent")));
                ((RectTransform)pop.tooltip).anchoredPosition = new Vector2(1060, 420);
            });
            Shot(outDir, "gorev", Path.Combine(drafts, "npc-gorev.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<QuestView>(canvas, "Quests");
                v.coin.text = "1.240";
                v.diamond.text = "85";
                v.hint.text = "Yenilenmeye 9 sa 41 dk · seri 3 gün";
                (string, string, float, string)[] q = { ("5 balık tut", "catch", 1f, "5 / 5"), ("1 tane rare ya da üstü yakala", "catch_tier", 0.33f, "1 / 3"), ("NPC'ye 5 şey sat", "sell", 0f, "0 / 5") };
                for (var i = 0; i < 3; i++)
                {
                    var r = v.quests[i];
                    r.icon.SetEmpty();
                    r.icon.SetIcon(q[i].Item2);
                    r.title.text = q[i].Item1;
                    v.SetBar(r, q[i].Item3);
                    r.count.text = q[i].Item4;
                    r.reward.text = "Ödül: günün sandığına sayılır";
                    r.state.text = i == 0 ? "Bitti" : "";
                }
                v.chest.icon.SetEmpty();
                v.chest.icon.SetIcon("chest");
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
                v.portrait.Show("ece-shot-id");
                v.displayName.text = "Ece";
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
                for (var i = 0; i < 3; i++) v.tabs[i].Set(i == 0);
                v.tabs[0].label.text = "Arkadaşlar 5";
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
                    r.player.text = name;
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
            foreach (var salvage in new[] { false, true })
            {
                var sv = salvage;
                Shot(outDir, sv ? "npc-parcala" : "npc-sat", Path.Combine(drafts, sv ? "npc-parcala.png" : "npc-sat.png"), canvas =>
                {
                    FillHud(Spawn<HudView>(canvas, "Hud"));
                    var v = Spawn<MerchantView>(canvas, "Merchant");
                    for (var i = 0; i < v.tabs.Length; i++) v.tabs[i].Set(i == (sv ? 1 : 0));
                    v.coin.text = "1.240";
                    v.dust.text = "85";
                    v.shop.SetActive(false);
                    for (var i = 0; i < 40; i++)
                    {
                        var s2 = UnityEngine.Object.Instantiate(v.bag.template, v.bag.content, false);
                        s2.gameObject.SetActive(true);
                        if (i < 25) s2.SetItem(i % 3 == 0 ? "lake.fish.sazan" : "lake.junk.boot", i % 4 == 0 ? "rare" : "", i % 3 == 1 ? 4 : 1, i == 0, i % 5 == 1);
                        else s2.SetEmpty();
                    }
                    string[] names = { "Sazan × 3", "Alabalık", "Midye · Worn", "Çizme", "Şişe", "Çizme", "Alabalık" };
                    string[] vals = { "15", "5", "17", "1", "1", "1", "5" };
                    for (var i = 0; i < v.lines.Length; i++)
                    {
                        var on = i < (sv ? 4 : 7);
                        v.lines[i].root.SetActive(on);
                        if (!on) continue;
                        v.lines[i].icon.SetItem("lake.fish.sazan", "", 1, false);
                        v.lines[i].name.text = names[i];
                        v.lines[i].value.text = sv ? new[] { "25", "2", "2", "5" }[i] : vals[i];
                        v.lines[i].valueIcon.color = sv ? new Color32(0x8f, 0xd3, 0xff, 255) : new Color32(0xf9, 0xc2, 0x2b, 255);
                    }
                    v.basketTitle.text = sv ? "Sepet · 4 kalem" : "Sepet · 7 kalem";
                    v.totalValue.text = sv ? "34" : "45";
                    v.totalIcon.color = sv ? new Color32(0x8f, 0xd3, 0xff, 255) : new Color32(0xf9, 0xc2, 0x2b, 255);
                    v.note.text = sv ? "Toz takas edilmez, craft için." : "Çöp ve sıradan balık da burada.";
                    v.sellButton.gameObject.SetActive(!sv);
                    v.salvageButton.gameObject.SetActive(sv);
                });
            }
            Shot(outDir, "npc-craft", Path.Combine(drafts, "npc-craft.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<CrafterView>(canvas, "Crafter");
                v.tabs[0].Set(true);
                v.tabs[1].Set(false);
                v.dust.text = "85";
                v.merge.SetActive(false);
                v.noRecipe.gameObject.SetActive(false);
                string[] rn = { "Pul Tılsımı", "Yosun Çelengi", "Tuna Kupası", "Deniz Tacı" };
                string[] rg = { "Normal", "Normal", "İyi", "Usta" };
                for (var i = 0; i < v.recipes.Length; i++)
                {
                    v.recipes[i].root.SetActive(i < 4);
                    if (i >= 4) continue;
                    v.recipes[i].back.sprite = i == 0 ? v.cardOn : v.cardOff;
                    v.recipes[i].name.text = rn[i];
                    v.recipes[i].name.color = i == 0 ? new Color32(0xf2, 0xe8, 0xd0, 255) : new Color32(0x45, 0x29, 0x3f, 255);
                    v.recipes[i].grade.text = rg[i];
                }
                v.recipeName.text = "Pul Tılsımı";
                v.recipeSub.text = "Normal recipe · bir kez harcanır";
                for (var i = 0; i < v.needs.Length; i++) v.needs[i].root.SetActive(i < 2);
                v.needs[0].icon.SetItem("lake.mat.scale", "", 1, false);
                v.needs[0].name.text = "Pul";
                v.needs[0].have.text = "4 / 3";
                v.needs[1].icon.SetItem("lake.mat.rope", "", 1, false);
                v.needs[1].name.text = "İp";
                v.needs[1].have.text = "0 / 1";
                v.needs[1].have.color = new Color32(0xe8, 0x3b, 0x3b, 255);
                v.recipeDust.supportRichText = true;
                v.recipeDust.text = "Toz 20   <color=#7f708a>(85 var)</color>";
                HudView.Fill(v.qualityFill, 0.5f);
                v.quality.text = "Normal";
                v.missing.text = "Eksik: İp";
                v.craftButton.interactable = false;
            });
            Shot(outDir, "npc-birlestir", Path.Combine(drafts, "npc-birlestir.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<CrafterView>(canvas, "Crafter");
                v.tabs[0].Set(false);
                v.tabs[1].Set(true);
                v.dust.text = "85";
                v.craft.SetActive(false);
                v.merge.SetActive(true);
                string[] fl = { "0.5120", "0.3340", "0.4410" };
                for (var i = 0; i < 3; i++)
                {
                    v.inputs[i].SetItem("lake.fish.tunek", "rare", 1, false);
                    v.inputNames[i].text = "Tünek";
                    v.inputFloats[i].text = fl[i];
                }
                v.result.SetEmpty();
                v.result.label.text = "?";
                v.resultName.text = "yeni Tünek";
                v.mergeDust.text = "Toz 50   <color=#7f708a>(Rare · 85 var) · Coin ücreti yok</color>";
                HudView.Fill(v.mergeFill, 0.5f);
                v.mergeQuality.text = "Normal";
                for (var i = 0; i < 20; i++)
                {
                    var s2 = UnityEngine.Object.Instantiate(v.bag.template, v.bag.content, false);
                    s2.gameObject.SetActive(true);
                    s2.SetItem(i % 2 == 0 ? "lake.fish.tunek" : "lake.junk.boot", i % 3 == 0 ? "rare" : "", 1, false);
                }
            });
            Shot(outDir, "npc-depo", Path.Combine(drafts, "npc-depo.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<BankView>(canvas, "Bank");
                v.stashCount.text = "25 / 100 yuva";
                for (var i = 0; i < 100; i++)
                {
                    var s2 = UnityEngine.Object.Instantiate(v.stash.template, v.stash.content, false);
                    s2.gameObject.SetActive(true);
                    if (i < 25) s2.SetItem(i % 2 == 0 ? "lake.fish.sazan" : "lake.junk.boot", i % 3 == 0 ? "rare" : "", 1, false);
                    else s2.SetEmpty();
                }
                for (var i = 0; i < 40; i++)
                {
                    var s2 = UnityEngine.Object.Instantiate(v.bag.template, v.bag.content, false);
                    s2.gameObject.SetActive(true);
                    if (i < 25) s2.SetItem(i % 2 == 0 ? "lake.fish.sazan" : "lake.junk.boot", i % 4 == 0 ? "rare" : "", 1, false);
                    else s2.SetEmpty();
                }
                v.expandSlots.text = "+20 yuva";
                v.expandPrice.text = "2.000";
            });
            Shot(outDir, "balik-at", Path.Combine(drafts, "balik-at.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<FishingView>(canvas, "Fishing");
                var feet = new Vector2(945, 896 - 455);
                v.charge.gameObject.SetActive(true);
                v.charge.anchoredPosition = feet + new Vector2(0, 64);
                Canvas.ForceUpdateCanvases();
                v.SetCharge(0.55f);
                v.hint.gameObject.SetActive(true);
                v.hint.anchoredPosition = feet + new Vector2(110, -8);
                v.hintText.text = "basılı tut, bırak";
            });
            Shot(outDir, "balik-vurus", Path.Combine(drafts, "balik-vurus.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<FishingView>(canvas, "Fishing");
                v.bite.gameObject.SetActive(true);
                v.bite.anchoredPosition = new Vector2(944, 896 - 460 + 76);
            });
            Shot(outDir, "balik-cekme", Path.Combine(drafts, "balik-cekme.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<FishingView>(canvas, "Fishing");
                var feet = new Vector2(945, 896 - 467);
                v.reel.gameObject.SetActive(true);
                v.reel.anchoredPosition = feet + new Vector2(-90, 0);
                Canvas.ForceUpdateCanvases();
                var h = v.water.rect.height;
                v.bar.sizeDelta = new Vector2(v.bar.sizeDelta.x, 0.2f * h);
                v.bar.anchoredPosition = new Vector2(0, 0.42f * h);
                v.fish.anchoredPosition = new Vector2(0, 0.5f * h - 9);
                v.progressFill.anchorMax = new Vector2(1, 0.6f);
                v.hint.gameObject.SetActive(true);
                v.hint.anchoredPosition = feet + new Vector2(-90, -4);
                v.hintText.text = "Space / fare basılı tut";
            });
            Shot(outDir, "balik-kesif", Path.Combine(drafts, "balik-kesif.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<CatchView>(canvas, "Catch");
                v.swap.gameObject.SetActive(false);
                v.discoverSlot.SetItem("lake.fish.altin", "epic", 1, false);
                v.discoverName.text = "Altın Balık";
                v.discoverTier.text = "Epic";
                v.discoverFloat.text = "Float 0.0312 · Pristine";
                v.discoverPage.text = "Göl Balıkları 8 / 12";
                HudView.Fill(v.discoverFill, 8f / 12f);
            });
            Shot(outDir, "balik-temiz", Path.Combine(drafts, "balik-temiz.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<CatchView>(canvas, "Catch");
                v.discover.gameObject.SetActive(false);
                v.oldSlot.SetItem("lake.fish.tunek", "rare", 1, false);
                v.newSlot.SetItem("lake.fish.tunek", "rare", 1, false);
                v.oldFloat.text = "0.4410";
                v.oldCondition.text = "Normal";
                v.newFloat.text = "0.0870";
                v.newCondition.text = "Excellent";
                v.swapCaption.text = "Tünek · Rare · eski kopya çantaya düşer";
            });
            Shot(outDir, "bildirim-yigin", Path.Combine(drafts, "bildirim-yigin.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<NoticesView>(canvas, "Notices");
                (string, string, Color32, bool)[] rows =
                {
                    ("Çanta dolu 100/100", "Av yapılamaz. Sat veya parçala.", new Color32(0xe8, 0x3b, 0x3b, 255), false),
                    ("Enerji azaldı: 10/100", "Bitince sadece çöp çıkar.", new Color32(0xf9, 0xc2, 0x2b, 255), false),
                    ("Olta yıpranıyor: %12", "Tüccar'da (Dükkan) tamir et.", new Color32(0xf9, 0xc2, 0x2b, 255), false),
                    ("Tezgahta satış: +240", "Mert Kral Sazan'ı aldı.", new Color32(0xf7, 0x96, 0x17, 255), false),
                };
                for (var i = 0; i < 4; i++)
                {
                    var b = v.boxes[i];
                    b.root.gameObject.SetActive(true);
                    b.icon.color = rows[i].Item3;
                    b.timer.color = rows[i].Item3;
                    b.title.text = rows[i].Item1;
                    b.sub.text = rows[i].Item2;
                    if (i == 0) b.sub.color = rows[i].Item3;
                    b.timer.rectTransform.localScale = new Vector3(i == 0 ? 1f : 0.7f - i * 0.1f, 1, 1);
                }
                v.more.SetActive(true);
                v.moreText.text = "+3 bildirim daha";
            });
            Shot(outDir, "bildirim-ust", Path.Combine(drafts, "bildirim-ust.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<NoticesView>(canvas, "Notices");
                v.announce.SetActive(true);
                v.announceTitle.text = "<color=#8fd3ff>Ece</color>  Mythic Altın Sazan yakaladı!";
                v.announceSub.text = "Pristine";
                v.levelUp.gameObject.SetActive(true);
                v.level.text = "Lv 8";
                string[] t = { "+5 enerji", "Yeni olta", "Yeni alan:" }, sub = { "sınırı", "açıldı", "Göl derinleri" };
                for (var i = 0; i < 3; i++)
                {
                    v.unlocks[i].SetActive(true);
                    v.unlockTitles[i].text = t[i];
                    v.unlockSubs[i].text = sub[i];
                }
            });
            Shot(outDir, "emote-menu", Path.Combine(drafts, "emote-menu.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<EmoteView>(canvas, "Emote");
                v.current.SetEmpty();
                v.current.SetIcon("status.fish");
                v.currentText.text = "Üstünde duruyor: Balık\n<color=#7f708a>Seçilince karakterinin üstünde kalır.</color>";
                string[] st = { "Gülümse", "Kahkaha", "Uykulu", "Balık", "Soru", "Kalp", "Müzik", "Kahve", "Yıldız", "Havalı", "Taç", "Parıltı" };
                for (var i = 0; i < v.status.Length; i++)
                {
                    if (i < st.Length) v.status[i].SetItem("x.a", i >= 8 ? "legendary" : "", 1, false, i == 3);
                    else v.status[i].SetEmpty();
                    if (i < st.Length) v.status[i].SetIcon("status." + st[i]);
                }
                string[] g = { "el salla", "alkış", "dans", "otur", "gül", "avı göster" };
                for (var i = 0; i < v.gestures.Length; i++)
                {
                    v.gestures[i].gameObject.SetActive(i < g.Length);
                    v.gestures[i].SetEmpty();
                    if (i < g.Length) v.gestures[i].SetIcon("gesture." + g[i]);
                }
            });
            Shot(outDir, "oyuncu-teklif", Path.Combine(drafts, "oyuncu-teklif.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<InviteView>(canvas, "TradeInvite");
                v.root.SetActive(true);
                v.title.text = "Deniz takas teklif ediyor";
                v.sub.text = "3 kare uzakta";
                HudView.Fill(v.timer, 0.6f);
                v.caption.text = "15 sn içinde cevap yoksa reddedilir";
            });
            Shot(outDir, "oyuncu-kart", Path.Combine(drafts, "oyuncu-kart.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var pop = Spawn<PopupView>(canvas, "Popup");
                pop.SendMessage("Awake", SendMessageOptions.DontRequireReceiver);
                pop.ShowMenu("Deniz", new (string, Action)[] { ("Profil", () => { }), ("Defterine bak", () => { }), ("Arkadaş ekle", () => { }), ("Fısılda", () => { }), ("Takas teklif et", () => { }), ("Engelle", () => { }), ("Şikayet et", () => { }) });
                ((RectTransform)pop.menu).anchoredPosition = new Vector2(480, 896 - 318); // menu top-left on the draft
            });
            foreach (var page in new[] { "_akis-1-baslik", "_akis-2-web-giris", "_akis-5-karakter", "_akis-6-sunucu", "_akis-7-yukleniyor" })
            {
                var pg = page;
                Shot(outDir, pg, Path.Combine(drafts, pg + ".png"), canvas =>
                {
                    var v = Spawn<LoginView>(canvas, "Login");
                    v.version.text = "v0.4 · Web";
                    v.title.SetActive(pg == "_akis-1-baslik");
                    v.titlePlate.SetActive(pg != "_akis-5-karakter" && pg != "_akis-6-sunucu");
                    ((RectTransform)v.titlePlate.transform).anchoredPosition = new Vector2(444, pg == "_akis-2-web-giris" ? -96 : -140);
                    v.guest.gameObject.SetActive(pg == "_akis-2-web-giris");
                    v.character.gameObject.SetActive(pg == "_akis-5-karakter");
                    v.servers.gameObject.SetActive(pg == "_akis-6-sunucu");
                    v.loading.SetActive(pg == "_akis-7-yukleniyor");
                    v.nameField.text = "Ece";
                    v.loadingText.text = "Liman sunucusuna bağlanıyor...";
                    HudView.Fill(v.loadingFill, 0.6f);
                    v.tip.text = "İpucu: Daha temiz Float'lı kopya gelirse deftere koymak sana sorulur.";
                    v.greeting.text = "Merhaba Ece! Arkadaşlarının olduğu sunucu üstte.";
                    (string, string, int, int, int)[] rows = { ("Liman", "tr", 2, 143, 200), ("Mercan", "tr", 0, 88, 200), ("Fener", "tr", 1, 196, 200), ("Harbor", "en", 0, 61, 200), ("Coral", "en", 0, 12, 200) };
                    for (var i = 0; i < v.rows.Length; i++)
                    {
                        var r = v.rows[i];
                        r.root.SetActive(i < rows.Length);
                        if (i >= rows.Length) continue;
                        var (n, lang, f, p, c) = rows[i];
                        r.back.sprite = f > 0 ? v.rowFriends : v.rowPlain;
                        r.flag.sprite = lang == "en" ? v.flagEn : v.flagTr;
                        r.name.text = n;
                        r.friends.text = f > 0 ? $"{f} arkadaş" : "";
                        HudView.Fill(r.fill, (float)p / c);
                        r.fillImage.sprite = p >= 180 ? v.fillRed : p >= 120 ? v.fillYellow : v.fillGreen;
                        r.count.text = $"{p} / {c}";
                        r.warn.text = p >= 180 ? "neredeyse dolu" : "";
                    }
                });
            }
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
            Shot(outDir, "ayarlar-hesap-ortu", Path.Combine(drafts, "ayarlar-hesap.png"), canvas =>
            {
                FillHud(Spawn<HudView>(canvas, "Hud"));
                var v = Spawn<SettingsView>(canvas, "Settings");
                SettingsTabs(v, false);
                v.accountContent.SetActive(false);
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
                void Msg(string nick, string text, bool mine, Color nc, Color tc)
                {
                    var l = UnityEngine.Object.Instantiate(w.lineTemplate, w.log, false);
                    l.gameObject.SetActive(true);
                    l.Set(nick, text, mine, nc, tc);
                }
                var ink = new Color32(0x45, 0x29, 0x3f, 0xff);
                Msg("Mert", "kristal kaça?", false, new Color32(0x1e, 0x6f, 0x50, 0xff), ink);
                Msg("Sen", "1.900, tezgahta", true, new Color32(0x9e, 0x45, 0x39, 0xff), ink);
                Msg(null, "Kişisel bilgi gizlendi", false, Color.gray, Color.gray);
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
            v.tabGeneral.Set(general);
            v.tabAccount.Set(!general);
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
            h.dust.text = "312";
            h.coin.text = "1.240";
            h.diamond.text = "85";
            if (h.miniMap != null)
            {
                Canvas.ForceUpdateCanvases();
                var npcs = new (string, string, Vector2)[]
                {
                    ("merchant", "Balıkçı Tüccar", new Vector2(73.5f, 52.5f)), ("crafter", "Zanaatkar", new Vector2(70.5f, 45.5f)),
                    ("quests", "Görevci", new Vector2(60.5f, 49.5f)), ("banker", "Bankacı", new Vector2(31.5f, 77.5f)),
                };
                new CollectionGame.World.MiniMap(h.miniMap, null).Tick(CollectionGame.World.LakeMap.Spawn + new Vector2(8, 0), npcs,
                    new[] { new Vector2(75f, 47f), new Vector2(66f, 58f) }, true);
            }
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
            // -shotScale 2: the canvas at 2x (a Retina screen), where GameText snaps its sizes differently.
            var scale = int.TryParse(Arg("-shotScale"), out var sc) && sc > 0 ? sc : 1;
            int w = (int)UiRoot.RefWidth * scale, h = (int)UiRoot.RefHeight * scale;
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
            scaler.scaleFactor = scale;
            canvas.scaleFactor = scale;
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
            foreach (var t in canvasGo.GetComponentsInChildren<GameText>(true)) t.Apply();
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
