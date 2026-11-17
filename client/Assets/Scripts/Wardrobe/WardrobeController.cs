using System;
using System.Collections.Generic;
using System.Linq;
using CollectionGame.Net;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace CollectionGame.Wardrobe
{
    /// <summary>
    /// The wardrobe window (docs/tasarim/20-gardirop.md, docs/protokol.md Gardırop). The player tries
    /// parts on a preview: own items, free parts in free colours, and any other part to try on.
    /// "Kaydet" sends the whole look (LOOK_SET); the server checks it and answers with LOOK_SHOW.
    /// A look holding a tried-on part cannot be saved. G or the HUD button opens it.
    /// </summary>
    public sealed class WardrobeController
    {
        public const int PageSize = 12;

        /// <summary>Window tabs and the catalog families (Excel Aile) under each.</summary>
        static readonly (string key, string[] families)[] Tabs =
        {
            ("wardrobe.tab.top", new[] { "UST", "CEKET" }),
            ("wardrobe.tab.bottom", new[] { "ALT", "ELBISE" }),
            ("wardrobe.tab.feet", new[] { "AYAK" }),
            ("wardrobe.tab.hat", new[] { "SAPKA", "BASORTU", "MIGFER" }),
            ("wardrobe.tab.hair", new[] { "SAC" }),
            ("wardrobe.tab.wings", new[] { "KANAT" }),
            ("wardrobe.tab.jewel", new[] { "TAKI", "BOYUN", "GOZ" }),
            ("wardrobe.tab.other", new[] { "PELERIN", "ZIRH", "KEMER", "CANTA" }),
        };

        /// <summary>Preview turn order: down, left, up, right (sheet rows 2, 1, 0, 3).</summary>
        static readonly int[] TurnRows = { 2, 1, 0, 3 };

        /// <summary>One part on the draft look: own item (instanceId) or a part in a chosen colour.</summary>
        sealed class Pick
        {
            public string part, color, color2, instanceId;
        }

        /// <summary>One slot of the grid.</summary>
        sealed class Entry
        {
            public WardrobePartDef def;
            public WardrobeItem item; // own copy, else null
        }

        readonly Connection net;

        public bool Open { get; set; }
        public WardrobeResponse Data { get; private set; }

        // The draft and what the server has.
        string body = Bodies.Male, skin = "skin_peach", eyes = "eye_blue";
        readonly Dictionary<string, Pick> worn = new Dictionary<string, Pick>();
        string savedJson = "";
        bool loading, saving;
        int tab, pageIndex, colorPage, turn;
        string selectedSlot;

        public WardrobeController(Connection net) => this.net = net;

        public void Update(bool typing)
        {
            var k = Keyboard.current;
            if (typing || k == null || !k.gKey.wasPressedThisFrame) return;
            Toggle();
        }

        public void Toggle()
        {
            Open = !Open;
            if (Open) Reload();
        }

        // ---------- server ----------

        public async void Reload()
        {
            if (loading) return;
            loading = true;
            dirty = true;
            try
            {
                var r = await net.GetWardrobeAsync();
                Data = r;
                SetDraft(r?.look, r?.worn);
                savedJson = DraftJson();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Wardrobe] get_wardrobe failed: {e.Message}");
                Toasts.Show(Loc.T("wardrobe.load_failed"), true);
            }
            finally
            {
                loading = false;
                dirty = true;
            }
        }

        /// <summary>Notification 120: the admin panel gave or took a part.</summary>
        public void OnChanged()
        {
            if (Open) Reload();
        }

        /// <summary>Own LOOK_SHOW: saved, refused (the server's look stands), or a rental ran out.</summary>
        public void OnLookShown(LookShowMsg m)
        {
            var wasSaving = saving;
            saving = false;
            if (!string.IsNullOrEmpty(m.reason))
            {
                Toasts.Show(Loc.Reason("wardrobe", m.reason), true);
                if (Open) Reload();
                return;
            }
            if (wasSaving) Toasts.Show(Loc.T("wardrobe.saved"));
            // Saved, a rental ran out or the panel took a part: the server's look and worn items.
            if (Open) Reload();
            else if (Data != null) Data.look = m.look;
            dirty = true;
        }

        void SetDraft(LookView look, WornSlot[] wornSlots)
        {
            worn.Clear();
            if (look == null || !look.IsSet) look = LpcLook.Fallback;
            body = LpcLook.BodyOf(look);
            skin = look.skin;
            eyes = look.eyes;
            foreach (var p in look.parts ?? new LookPartView[0])
            {
                var def = Def(p?.part);
                if (def == null) continue;
                var instance = wornSlots?.FirstOrDefault(w => w.slot == def.slot)?.instanceId;
                worn[def.slot] = new Pick { part = p.part, color = p.color ?? "", color2 = p.color2 ?? "", instanceId = string.IsNullOrEmpty(instance) ? null : instance };
            }
        }

        void Save()
        {
            if (!Saveable || saving) return;
            saving = true;
            net.Send(OpCode.LookSet, new LookSetMsg
            {
                body = body,
                skin = skin,
                eyes = eyes,
                parts = worn.Values.Select(p => new LookSetPart
                {
                    part = p.part,
                    color = p.color ?? "",
                    color2 = p.color2 ?? "",
                    instanceId = p.instanceId ?? "",
                }).ToArray(),
            });
            dirty = true;
        }

        void Revert()
        {
            SetDraft(Data?.look, Data?.worn);
            dirty = true;
        }

        // ---------- the rules the window needs (the server checks them again) ----------

        static WardrobeCatalogView Catalog => ItemContent.Wardrobe;

        static WardrobePartDef Def(string id) =>
            string.IsNullOrEmpty(id) ? null : Catalog?.parts?.FirstOrDefault(p => p.id == id);

        static WardrobeColorDef ColorDef(string id) =>
            string.IsNullOrEmpty(id) ? null : Catalog?.colors?.FirstOrDefault(c => c.id == id);

        static bool FreeColor(string id) => string.IsNullOrEmpty(id) || (ColorDef(id)?.free ?? false);

        bool OnBody(WardrobePartDef d) => d.bodies != null && d.bodies.Contains(body);

        /// <summary>Kept on save: an own item, or a free part in free colours.</summary>
        bool Keeps(Pick p)
        {
            if (!string.IsNullOrEmpty(p.instanceId)) return Data?.items?.Any(i => i.instanceId == p.instanceId) ?? false;
            var d = Def(p.part);
            return d != null && d.free && FreeColor(p.color) && FreeColor(p.color2);
        }

        bool Saveable => Data != null && !saving && worn.Values.All(Keeps) && worn.Values.All(p => Def(p.part) is { } d && OnBody(d)) && DraftJson() != savedJson;

        int Changes
        {
            get
            {
                if (Data?.look == null) return 0;
                var saved = new Dictionary<string, string>();
                foreach (var p in Data.look.parts ?? new LookPartView[0])
                    if (Def(p.part) is { } d) saved[d.slot] = p.part + "|" + p.color + "|" + p.color2;
                var n = 0;
                foreach (var slot in saved.Keys.Union(worn.Keys))
                {
                    saved.TryGetValue(slot, out var a);
                    var b = worn.TryGetValue(slot, out var p) ? p.part + "|" + p.color + "|" + p.color2 : null;
                    if (a != b) n++;
                }
                if (body != LpcLook.BodyOf(Data.look)) n++;
                if (skin != Data.look.skin) n++;
                if (eyes != Data.look.eyes) n++;
                return n;
            }
        }

        string DraftJson() => JsonUtility.ToJson(DraftLook()) + string.Join(",", worn.Values.Select(p => p.instanceId));

        LookView DraftLook() => new LookView
        {
            body = body,
            skin = skin,
            eyes = eyes,
            parts = worn.OrderBy(kv => kv.Key).Select(kv => new LookPartView { part = kv.Value.part, color = kv.Value.color, color2 = kv.Value.color2 }).ToArray(),
        };

        /// <summary>The tab's slots: own items, then free parts, then the rest to try on.</summary>
        List<Entry> Entries()
        {
            var list = new List<Entry>();
            var cat = Catalog;
            if (cat?.parts == null) return list;
            var fams = Tabs[tab].families;
            var defs = cat.parts.Where(d => d.active && fams.Contains(d.family) && OnBody(d)).ToList();
            var owned = new HashSet<string>();
            foreach (var it in Data?.items ?? new WardrobeItem[0])
            {
                var d = defs.FirstOrDefault(x => x.id == it.part);
                if (d == null) continue;
                owned.Add(d.id);
                list.Add(new Entry { def = d, item = it });
            }
            list.AddRange(defs.Where(d => d.free && !owned.Contains(d.id)).Select(d => new Entry { def = d }));
            list.AddRange(defs.Where(d => !d.free && !owned.Contains(d.id)).Select(d => new Entry { def = d }));
            return list;
        }

        /// <summary>Colours the part takes (its kinds, then its Mythic effects).</summary>
        static List<string> ColorsOf(WardrobePartDef d)
        {
            var list = new List<string>();
            if (d?.colors == null || Catalog?.colors == null) return list;
            list.AddRange(Catalog.colors.Where(c => d.colors.Contains(c.kind)).Select(c => c.id));
            if (d.effects != null) list.AddRange(d.effects.Where(e => !list.Contains(e)));
            return list;
        }

        static string FirstColor(WardrobePartDef d, string[] kinds, bool freeOnly)
        {
            if (kinds == null || kinds.Length == 0 || Catalog?.colors == null) return "";
            var c = Catalog.colors.FirstOrDefault(x => kinds.Contains(x.kind) && (!freeOnly || x.free));
            return c?.id ?? "";
        }

        void Wear(Entry e)
        {
            var d = e.def;
            selectedSlot = d.slot;
            colorPage = 0;
            if (worn.TryGetValue(d.slot, out var cur) && cur.part == d.id && (e.item == null ? cur.instanceId == null : cur.instanceId == e.item.instanceId))
            {
                worn.Remove(d.slot); // clicked what is on: take it off
                dirty = true;
                return;
            }
            worn[d.slot] = e.item != null
                ? new Pick { part = d.id, color = e.item.color ?? "", color2 = e.item.color2 ?? "", instanceId = e.item.instanceId }
                : new Pick { part = d.id, color = FirstColor(d, d.colors, d.free), color2 = FirstColor(d, d.color2, d.free) };
            dirty = true;
        }

        void Recolor(string colorId)
        {
            if (selectedSlot == null || !worn.TryGetValue(selectedSlot, out var p)) return;
            p.color = colorId;
            // Another own copy in this colour, else it becomes a try-on.
            var mine = Data?.items?.FirstOrDefault(i => i.part == p.part && i.color == colorId);
            p.instanceId = mine?.instanceId;
            if (mine != null) p.color2 = mine.color2 ?? "";
            dirty = true;
        }

        void SetBody(string b)
        {
            if (body == b) return;
            body = b;
            foreach (var slot in worn.Where(kv => Def(kv.Value.part) is not { } d || !OnBody(d)).Select(kv => kv.Key).ToList())
                worn.Remove(slot); // not drawn for this body
            pageIndex = 0;
            dirty = true;
        }

        // ---------- UI (uGUI: Resources/UI/Wardrobe, draft gardirop) ----------

        WardrobeView view;
        bool dirty = true;
        int locVersion;
        readonly List<Image> previewLayers = new List<Image>();
        List<Entry> shown = new List<Entry>();
        List<string> shownColors = new List<string>();
        int colorsPerPage;

        WardrobeView View
        {
            get
            {
                if (view != null) return view;
                view = UiRoot.Get().Spawn<WardrobeView>("Wardrobe");
                if (view != null) Wire(view);
                return view;
            }
        }

        void Wire(WardrobeView v)
        {
            v.window.Closed = () => Open = false;
            v.window.Open = false;
            colorsPerPage = v.colors.Length;
            v.turnLeft.onClick.AddListener(() => { turn = (turn + 3) % 4; dirty = true; });
            v.turnRight.onClick.AddListener(() => { turn = (turn + 1) % 4; dirty = true; });
            v.bodyMale.button.onClick.AddListener(() => SetBody(Bodies.Male));
            v.bodyFemale.button.onClick.AddListener(() => SetBody(Bodies.Female));
            for (var i = 0; i < v.skins.Length; i++)
            {
                var n = i;
                v.skins[i].onClick.AddListener(() => { if (n < Skins.Count) { skin = Skins[n]; dirty = true; } });
            }
            for (var i = 0; i < v.eyes.Length; i++)
            {
                var n = i;
                v.eyes[i].onClick.AddListener(() => { if (n < Eyes.Count) { eyes = Eyes[n]; dirty = true; } });
            }
            for (var i = 0; i < v.tabs.Length; i++)
            {
                var n = i;
                v.tabs[i].button.onClick.AddListener(() => { tab = n; pageIndex = 0; dirty = true; });
            }
            foreach (var s in v.parts)
                s.Clicked = slot => { if (slot.Data is Entry e) Wear(e); };
            v.prevPage.onClick.AddListener(() => { pageIndex--; dirty = true; });
            v.nextPage.onClick.AddListener(() => { pageIndex++; dirty = true; });
            for (var i = 0; i < v.colors.Length; i++)
            {
                var n = i;
                v.colors[i].onClick.AddListener(() =>
                {
                    var at = colorPage * colorsPerPage + n;
                    if (at < shownColors.Count) Recolor(shownColors[at]);
                });
            }
            v.prevColors.onClick.AddListener(() => { colorPage--; dirty = true; });
            v.nextColors.onClick.AddListener(() => { colorPage++; dirty = true; });
            v.takeOff.onClick.AddListener(() =>
            {
                if (selectedSlot != null && worn.Remove(selectedSlot)) dirty = true;
            });
            v.revert.onClick.AddListener(Revert);
            v.save.onClick.AddListener(Save);
        }

        static List<string> Skins => Catalog?.colors?.Where(c => c.kind == "skin").Select(c => c.id).ToList() ?? new List<string>();
        static List<string> Eyes => Catalog?.colors?.Where(c => c.kind == "eye").Select(c => c.id).ToList() ?? new List<string>();

        public void Destroy()
        {
            if (view != null) UnityEngine.Object.Destroy(view.gameObject);
        }

        /// <summary>Call every frame: follows Open and redraws after a change.</summary>
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
                locVersion = Loc.Version;
                dirty = true;
            }
            if (dirty) Redraw(v);
        }

        void Redraw(WardrobeView v)
        {
            dirty = false;
            DrawPreview(v);

            v.bodyMale.Set(body == Bodies.Male);
            v.bodyFemale.Set(body == Bodies.Female);
            Swatches(v.skins, Skins, skin);
            Swatches(v.eyes, Eyes, eyes);
            for (var i = 0; i < v.tabs.Length; i++)
            {
                v.tabs[i].Set(i == tab);
                if (i < Tabs.Length) v.tabs[i].label.text = Loc.T(Tabs[i].key);
            }

            // Grid.
            var all = Data == null ? new List<Entry>() : Entries();
            var pages = Mathf.Max(1, (all.Count + PageSize - 1) / PageSize);
            pageIndex = Mathf.Clamp(pageIndex, 0, pages - 1);
            shown = all.Skip(pageIndex * PageSize).Take(v.parts.Length).ToList();
            for (var i = 0; i < v.parts.Length; i++)
            {
                var s = v.parts[i];
                if (i >= shown.Count)
                {
                    s.SetEmpty();
                    continue;
                }
                var e = shown[i];
                var on = worn.TryGetValue(e.def.slot, out var p) && p.part == e.def.id && (e.item == null ? p.instanceId == null : p.instanceId == e.item.instanceId);
                var color = on ? p.color : e.item?.color ?? FirstColor(e.def, e.def.colors, e.def.free);
                var color2 = on ? p.color2 : e.item?.color2 ?? FirstColor(e.def, e.def.color2, e.def.free);
                var tier = e.item != null && (e.item.color ?? "").StartsWith("fx_") ? Tiers.Mythic : e.def.tier;
                s.SetItem(null, tier, 1, e.item != null && e.item.until > 0, on);
                s.SetPicture(LpcLook.Thumb(e.def.id, body, color, color2));
                s.count.text = e.item != null ? "" : e.def.free ? "" : Loc.T("wardrobe.try_mark");
                s.Data = e;
            }
            v.page.text = $"{pageIndex + 1} / {pages}";
            v.prevPage.interactable = pageIndex > 0;
            v.nextPage.interactable = pageIndex < pages - 1;

            DrawInfo(v);

            var changes = Changes;
            v.changes.text = loading ? Loc.T("wardrobe.loading") : changes > 0 ? Loc.T("wardrobe.changes", ("count", changes)) : "";
            v.revert.interactable = changes > 0 && !saving;
            v.save.interactable = Saveable;
        }

        void DrawInfo(WardrobeView v)
        {
            Pick p = null;
            if (selectedSlot != null) worn.TryGetValue(selectedSlot, out p);
            var d = Def(p?.part);
            v.takeOff.interactable = d != null;
            if (d == null)
            {
                v.partName.text = Loc.T("wardrobe.pick_part");
                v.partTier.text = "";
                v.partInfo.text = "";
                v.colorNote.text = "";
                shownColors = new List<string>();
                Swatches(v.colors, shownColors, null);
                v.prevColors.interactable = v.nextColors.interactable = false;
                return;
            }
            v.partName.text = d.name;
            var item = string.IsNullOrEmpty(p.instanceId) ? null : Data?.items?.FirstOrDefault(i => i.instanceId == p.instanceId);
            var tier = (p.color ?? "").StartsWith("fx_") ? Tiers.Mythic : d.tier;
            v.partTier.text = d.free && item == null ? Loc.T("wardrobe.free") : ItemText.TierName(tier);
            v.partTier.color = d.free && item == null ? v.partName.color : ItemText.TierColour(tier);
            v.partInfo.text = item != null ? SourceText(item) : Keeps(p) ? Loc.T("wardrobe.free_note") : Loc.T("wardrobe.try_note");

            shownColors = ColorsOf(d);
            var pages = Mathf.Max(1, (shownColors.Count + colorsPerPage - 1) / Mathf.Max(1, colorsPerPage));
            colorPage = Mathf.Clamp(colorPage, 0, pages - 1);
            Swatches(v.colors, shownColors.Skip(colorPage * colorsPerPage).ToList(), p.color);
            v.prevColors.interactable = colorPage > 0;
            v.nextColors.interactable = colorPage < pages - 1;
            v.colorNote.text = shownColors.Count == 0 ? Loc.T("wardrobe.fixed_color")
                : item != null ? Loc.T("wardrobe.owned_color_note")
                : d.free ? Loc.T("wardrobe.free_color_note")
                : Loc.T("wardrobe.try_color_note");
        }

        static string SourceText(WardrobeItem it)
        {
            var src = Loc.T("wardrobe.source." + (string.IsNullOrEmpty(it.source) ? "admin" : it.source));
            if (it.until <= 0) return Loc.T("wardrobe.owned", ("source", src));
            var left = TimeSpan.FromMilliseconds(Math.Max(0, it.until - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
            return Loc.T("wardrobe.rented", ("source", src), ("days", (int)left.TotalDays), ("hours", left.Hours));
        }

        /// <summary>Colour buttons: the button's picture tinted with the colour's middle tone, a frame on the chosen one.</summary>
        static void Swatches(Button[] buttons, List<string> ids, string chosen)
        {
            for (var i = 0; i < buttons.Length; i++)
            {
                var b = buttons[i];
                var has = i < ids.Count;
                b.gameObject.SetActive(has);
                if (!has) continue;
                if (b.targetGraphic is Image img) img.color = LpcManifest.Swatch(ids[i]);
                var mark = b.transform.Find("Chosen");
                if (mark != null) mark.gameObject.SetActive(ids[i] == chosen);
            }
        }

        void DrawPreview(WardrobeView v)
        {
            var layers = LpcLook.Layers(DraftLook());
            while (previewLayers.Count < layers.Count)
            {
                var go = new GameObject("Layer" + previewLayers.Count, typeof(RectTransform), typeof(Image));
                var rt = (RectTransform)go.transform;
                rt.SetParent(v.preview, false);
                rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
                rt.sizeDelta = new Vector2(LpcLook.Frame * 4, LpcLook.Frame * 4);
                var img = go.GetComponent<Image>();
                img.raycastTarget = false;
                previewLayers.Add(img);
            }
            var row = TurnRows[turn];
            for (var i = 0; i < previewLayers.Count; i++)
            {
                var img = previewLayers[i];
                var s = i < layers.Count ? LpcLook.Standing(layers[i], row, 0.5f) : null;
                img.sprite = s;
                img.enabled = s != null;
            }
        }
    }
}
