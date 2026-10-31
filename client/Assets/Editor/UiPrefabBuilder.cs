using System.Collections.Generic;
using System.IO;
using System.Linq;
using CollectionGame.UI;
using CollectionGame.UI.Views;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// Builds the uGUI prefabs in Assets/Resources/UI/ from the UI kit (Assets/Art/UI/, 9-slice
    /// borders from ui-borders.json via PixelArtImporter). Layout follows the drafts in
    /// docs/gorsel/ui-taslaklar/: 1408x896 with one kit pixel = one canvas unit.
    ///
    /// Runs by itself when the editor loads and <see cref="Version"/> is newer than the built
    /// prefabs; menu: CollectionGame > UI > Build Prefabs. Bump Version after changing a layout.
    /// Prefabs marked as hand-edited (Editor/UiHandEdited.txt, menu Mark / Unmark) are skipped with a
    /// warning; "Rebuild all (overwrite)" builds them too (docs/araclar/ui-uygulama.md, Elle düzenleme).
    /// </summary>
    [InitializeOnLoad]
    public static class UiPrefabBuilder
    {
        public const int Version = 34;
        const string Kit = "Assets/Art/UI/";
        const string Out = "Assets/Resources/UI/";
        const string VersionFile = Out + "BuilderVersion.txt";

        // Kit colours (Resurrect 64).
        static readonly Color Ink = Hex("45293f");
        static readonly Color Paper = Hex("f2e8d0");
        static readonly Color Faint = new Color(0.27f, 0.16f, 0.25f, 0.65f);
        static readonly Color Gold = Hex("f9c22b");
        static readonly Color CoinColour = Hex("e6904e");
        static readonly Color DiamondColour = Hex("8fd3ff");
        static readonly Color DustColour = Hex("4d9be6");
        static readonly Color Xp = Hex("a884f3");

        const string HandEditedFile = "Assets/Editor/UiHandEdited.txt";
        static bool overwrite;

        /// <summary>The font slot: Assets/Resources/Fonts/ (GameFont), else the built-in font.</summary>
        static Font Font => GameFont.Get();

        static UiPrefabBuilder()
        {
            if (Application.isBatchMode) return;
            EditorApplication.delayCall += () =>
            {
                if (Stale()) Build();
            };
        }

        /// <summary>Builds when the prefabs are missing or older than <see cref="Version"/> (player builds call this).</summary>
        public static void BuildIfStale()
        {
            if (Stale()) Build();
        }

        static bool Stale()
        {
            if (!File.Exists(VersionFile)) return true;
            return !int.TryParse(File.ReadAllText(VersionFile).Trim(), out var v) || v < Version;
        }

        [MenuItem("CollectionGame/UI/Rebuild all (overwrite)", false, 1)]
        static void RebuildAll()
        {
            var locked = HandEdited();
            if (locked.Count > 0 && !EditorUtility.DisplayDialog("UI prefabları",
                    "Elle düzenlenmiş prefablar da ezilecek:\n" + string.Join(", ", locked) + "\n\nDevam?", "Ez", "Vazgeç"))
                return;
            overwrite = true;
            try { Build(); }
            finally { overwrite = false; }
        }

        [MenuItem("CollectionGame/UI/Mark selected prefab as hand-edited", false, 20)]
        static void Mark() => SetHandEdited(true);

        [MenuItem("CollectionGame/UI/Unmark selected prefab (builder may overwrite)", false, 21)]
        static void Unmark() => SetHandEdited(false);

        [MenuItem("CollectionGame/UI/Mark selected prefab as hand-edited", true)]
        [MenuItem("CollectionGame/UI/Unmark selected prefab (builder may overwrite)", true)]
        static bool CanMark() => SelectedPrefab() != null;

        const string StylePath = "Assets/Resources/UiStyle.asset";

        /// <summary>Makes Resources/UiStyle.asset (the one place for the UI look) when it is missing.</summary>
        [MenuItem("CollectionGame/UI/Style asset (UiStyle)", false, 30)]
        static void StyleMenu()
        {
            EnsureStyle();
            Selection.activeObject = AssetDatabase.LoadAssetAtPath<UiStyle>(StylePath);
        }

        static void EnsureStyle()
        {
            if (AssetDatabase.LoadAssetAtPath<UiStyle>(StylePath) != null) return;
            AssetDatabase.CreateAsset(ScriptableObject.CreateInstance<UiStyle>(), StylePath);
            AssetDatabase.SaveAssets();
        }

        [MenuItem("CollectionGame/UI/Check font (Türkçe)", false, 40)]
        static void CheckFont()
        {
            var missing = GameFont.Missing();
            var which = GameFont.Custom ? GameFont.Get().name : "Unity'nin yerleşik fontu (Resources/Fonts boş)";
            if (missing.Length == 0) Debug.Log($"[UI] Font {which}: Türkçe harflerin hepsi var ({GameFont.Turkish})");
            else Debug.LogWarning($"[UI] Font {which}: eksik harfler: {missing}");
        }

        /// <summary>Name of the UI prefab selected in the Project window (Resources/UI/X.prefab), or null.</summary>
        static string SelectedPrefab()
        {
            var path = Selection.activeObject != null ? AssetDatabase.GetAssetPath(Selection.activeObject) : null;
            return path != null && path.StartsWith(Out) && path.EndsWith(".prefab") ? Path.GetFileNameWithoutExtension(path) : null;
        }

        static List<string> HandEdited() =>
            File.Exists(HandEditedFile)
                ? File.ReadAllLines(HandEditedFile).Select(l => l.Trim()).Where(l => l.Length > 0 && !l.StartsWith("#")).ToList()
                : new List<string>();

        static void SetHandEdited(bool on)
        {
            var name = SelectedPrefab();
            if (name == null) return;
            var list = HandEdited();
            list.Remove(name);
            if (on) list.Add(name);
            list.Sort();
            File.WriteAllText(HandEditedFile, "# UI prefabs edited by hand in Unity: UiPrefabBuilder skips them (CollectionGame > UI > Mark / Unmark).\n" + string.Join("\n", list) + "\n");
            AssetDatabase.ImportAsset(HandEditedFile);
            Debug.Log(on ? $"[UI] {name} elle düzenlendi olarak işaretlendi: builder artık ezmez" : $"[UI] {name} kilidi kalktı: sonraki build ezer");
        }

        [MenuItem("CollectionGame/UI/Build Prefabs", false, 0)]
        public static void Build()
        {
            if (AssetDatabase.LoadAssetAtPath<Sprite>(Kit + "window.png") == null)
            {
                Debug.LogWarning("[UI] Kit sprites not imported yet; prefabs not built");
                return;
            }
            Directory.CreateDirectory(Out);
            EnsureStyle();
            Save(BuildHud(), "Hud");
            Save(BuildBag(), "Bag");
            Save(BuildPopup(), "Popup");
            Save(BuildQuests(), "Quests");
            Save(BuildBook(), "Book");
            Save(BuildProfile(), "Profile");
            Save(BuildFriends(), "Friends");
            Save(BuildMerchant(), "Merchant");
            Save(BuildCrafter(), "Crafter");
            Save(BuildBank(), "Bank");
            Save(BuildFishing(), "Fishing");
            Save(BuildCatch(), "Catch");
            Save(BuildNotices(), "Notices");
            Save(BuildLogin(), "Login");
            Save(BuildSettings(), "Settings");
            Save(BuildTrade(), "Trade");
            Save(BuildCount(), "Count");
            Save(BuildInvite(), "TradeInvite");
            Save(BuildEmote(), "Emote");
            Save(BuildStallSetup(), "StallSetup");
            Save(BuildStallList(), "Stall");
            Save(BuildBoard(), "Board");
            Save(BuildWhisper(), "Whisper");
            Save(BuildBubble(), "Bubble");
            File.WriteAllText(VersionFile, Version + "\n");
            AssetDatabase.ImportAsset(VersionFile);
            AssetDatabase.SaveAssets();
            Debug.Log($"[UI] Built UI prefabs (version {Version}) in {Out}");
            var missing = GameFont.Missing();
            if (missing.Length > 0) Debug.LogWarning($"[UI] Font {Font.name}: eksik Türkçe harfler: {missing}");
        }

        static void Save(GameObject go, string name)
        {
            if (!overwrite && File.Exists(Out + name + ".prefab") && HandEdited().Contains(name))
            {
                Debug.LogWarning($"[UI] {name}.prefab elle düzenlendi, builder atladı (ezmek için CollectionGame > UI > Rebuild all (overwrite))");
                Object.DestroyImmediate(go);
                return;
            }
            PrefabUtility.SaveAsPrefabAsset(go, Out + name + ".prefab");
            Object.DestroyImmediate(go);
        }

        // ================= shared parts =================

        static Sprite S(string name)
        {
            var s = AssetDatabase.LoadAssetAtPath<Sprite>(Kit + name + ".png");
            if (s == null) Debug.LogWarning($"[UI] Missing kit sprite {name}");
            return s;
        }

        static RectTransform Node(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = 5; // UI
            var rt = (RectTransform)go.transform;
            if (parent != null) rt.SetParent(parent, false);
            return rt;
        }

        /// <summary>Anchors at one corner / edge; pos is the offset from it, in kit pixels.</summary>
        static RectTransform At(RectTransform rt, Vector2 anchor, Vector2 pos, Vector2 size, Vector2? pivot = null)
        {
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = pivot ?? anchor;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            return rt;
        }

        /// <summary>Fills the parent, inset by left, bottom, right, top.</summary>
        static RectTransform Stretch(RectTransform rt, float l = 0, float b = 0, float r = 0, float t = 0)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(l, b);
            rt.offsetMax = new Vector2(-r, -t);
            return rt;
        }

        static readonly Vector2 TopLeft = new Vector2(0, 1), TopRight = new Vector2(1, 1), BottomLeft = Vector2.zero,
            BottomRight = new Vector2(1, 0), Top = new Vector2(0.5f, 1), Center = new Vector2(0.5f, 0.5f);

        static Image Img(RectTransform rt, string sprite, Image.Type type = Image.Type.Sliced, bool raycast = false)
        {
            var img = rt.gameObject.AddComponent<Image>();
            if (sprite != null) img.sprite = S(sprite);
            img.type = img.sprite == null ? Image.Type.Simple : type;
            img.raycastTarget = raycast;
            return img;
        }

        static Image Solid(RectTransform rt, Color c)
        {
            var img = rt.gameObject.AddComponent<Image>();
            img.color = c;
            img.raycastTarget = false;
            return img;
        }

        /// <summary>
        /// THE text: a GameText (font, sharpness and shadow from UiStyle). bold is ignored while the
        /// style has bold off (a pixel font smears when Unity fakes bold); shadow forces the shadow on
        /// dark text too (light text gets it anyway).
        /// </summary>
        static Text Txt(RectTransform rt, string text, int size, Color colour, TextAnchor align = TextAnchor.MiddleLeft, bool bold = false, bool shadow = false)
        {
            var t = rt.gameObject.AddComponent<GameText>();
            t.font = Font;
            t.text = text;
            t.Size = size;
            t.fontSize = size;
            t.color = colour;
            t.alignment = align;
            t.fontStyle = bold && UiStyle.Get().allowBoldItalic ? FontStyle.Bold : FontStyle.Normal;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            t.ForceShadow = shadow;
            return t;
        }

        static Text Label(Transform parent, string name, string text, int size, Color colour, TextAnchor align = TextAnchor.MiddleLeft, bool bold = false, bool shadow = false) =>
            Txt(Node(name, parent), text, size, colour, align, bold, shadow);

        /// <summary>A kit button: colour is wood / green / red / flat / square_wood..., with sprite swap states.</summary>
        static Button Btn(Transform parent, string name, string colour, string label, int textSize = 13)
        {
            var rt = Node(name, parent);
            var img = Img(rt, $"button_{colour}_normal", Image.Type.Sliced, true);
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = img;
            b.transition = Selectable.Transition.SpriteSwap;
            b.spriteState = new SpriteState
            {
                highlightedSprite = S($"button_{colour}_hover"),
                pressedSprite = S($"button_{colour}_pressed"),
                selectedSprite = S($"button_{colour}_normal"),
                disabledSprite = File.Exists(Kit + $"button_{colour}_disabled.png") ? S($"button_{colour}_disabled") : S($"button_{colour}_normal"),
            };
            var nav = b.navigation;
            nav.mode = Navigation.Mode.None;
            b.navigation = nav;
            if (label != null)
            {
                var text = Txt(Stretch(Node("Label", rt), 2, 2, 2, 1), label, textSize, colour.Contains("flat") ? Ink : Paper, TextAnchor.MiddleCenter, true);
                text.horizontalOverflow = HorizontalWrapMode.Wrap;
            }
            return b;
        }

        /// <summary>Kit text field (input_normal / input_focus) on an existing node.</summary>
        static InputField Field(RectTransform rt, string placeholderText, int size = 13)
        {
            var img = Img(rt, "input_normal", Image.Type.Sliced, true);
            var field = rt.gameObject.AddComponent<InputField>();
            field.targetGraphic = img;
            field.transition = Selectable.Transition.SpriteSwap;
            field.spriteState = new SpriteState { selectedSprite = S("input_focus"), highlightedSprite = S("input_normal") };
            field.lineType = InputField.LineType.SingleLine;
            var nav = field.navigation;
            nav.mode = Navigation.Mode.None;
            field.navigation = nav;
            var text = Txt(Stretch(Node("Text", rt), 6, 1, 6, 1), "", size, Ink);
            text.supportRichText = false;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            var placeholder = Txt(Stretch(Node("Placeholder", rt), 6, 1, 6, 1), placeholderText, size, Faint);
                        field.textComponent = text;
            field.placeholder = placeholder;
            return field;
        }

        static LayoutElement Size(Component c, float minW = -1, float minH = -1, float prefW = -1, float prefH = -1, float flexW = -1, float flexH = -1)
        {
            var le = c.GetComponent<LayoutElement>();
            if (le == null) le = c.gameObject.AddComponent<LayoutElement>();
            le.minWidth = minW;
            le.minHeight = minH;
            le.preferredWidth = prefW;
            le.preferredHeight = prefH;
            le.flexibleWidth = flexW;
            le.flexibleHeight = flexH;
            return le;
        }

        static T Layout<T>(RectTransform rt, int spacing, RectOffset padding = null, TextAnchor align = TextAnchor.UpperLeft) where T : HorizontalOrVerticalLayoutGroup
        {
            var g = rt.gameObject.AddComponent<T>();
            g.spacing = spacing;
            g.padding = padding ?? new RectOffset(0, 0, 0, 0);
            g.childAlignment = align;
            g.childControlWidth = g.childControlHeight = true;
            g.childForceExpandWidth = g.childForceExpandHeight = false;
            return g;
        }

        /// <summary>Kit window: tiled frame, title plate above the top edge, close button. Content goes in body.</summary>
        static WindowView Window(Transform parent, string name, string title, Vector2 size)
        {
            var rt = Node(name, parent);
            rt.sizeDelta = size;
            Img(rt, "window", Image.Type.Tiled, true);
            var view = rt.gameObject.AddComponent<WindowView>();

            var plate = At(Node("Plate", rt), Top, new Vector2(0, 10), new Vector2(Mathf.Max(120, title.Length * 10 + 50), 28), Top);
            Img(plate, "button_wood_normal", Image.Type.Sliced, true);
            view.title = Txt(Stretch(Node("Title", plate), 4, 2, 4, 2), title, 16, Paper, TextAnchor.MiddleCenter, true);
            view.plate = plate;

            var close = At(Node("Close", rt), TopRight, new Vector2(-8, -8), new Vector2(24, 24));
            var img = Img(close, "button_close_normal", Image.Type.Simple, true);
            var b = close.gameObject.AddComponent<Button>();
            b.targetGraphic = img;
            b.transition = Selectable.Transition.SpriteSwap;
            b.spriteState = new SpriteState { highlightedSprite = S("button_close_hover"), pressedSprite = S("button_close_pressed") };
            view.close = b;

            view.body = Stretch(Node("Body", rt), 16, 16, 18, 24);
            return view;
        }

        static SlotView Slot(Transform parent, string name, float size = 40)
        {
            var rt = Node(name, parent);
            rt.sizeDelta = new Vector2(size, size);
            var view = rt.gameObject.AddComponent<SlotView>();
            view.frame = Img(rt, "slot_empty", Image.Type.Sliced, true);
            view.frame.pixelsPerUnitMultiplier = 2; // the drafts draw item slots at 1x (40x40, thin frame)
            view.empty = S("slot_empty");
            view.selected = S("slot_selected");
            view.locked = S("slot_locked");
            view.tiers = new[] { S("slot_tier_common"), S("slot_tier_rare"), S("slot_tier_epic"), S("slot_tier_legendary"), S("slot_tier_mythic") };
            view.label = Txt(Stretch(Node("Name", rt), 2, 8, 2, 4), "", 10, Ink, TextAnchor.MiddleCenter, true);
            view.count = Txt(Stretch(Node("Count", rt), 2, 2, 4, 26), "", 11, Paper, TextAnchor.LowerRight, true, true);
            var lockMark = At(Node("Lock", rt), TopRight, new Vector2(-3, -3), new Vector2(8, 8));
            Solid(lockMark, Gold);
            view.lockMark = lockMark.gameObject;
            lockMark.gameObject.SetActive(false);
            return view;
        }

        /// <summary>bar_back with a fill child whose width is set at runtime (HudView.Fill).</summary>
        static RectTransform Bar(RectTransform back, string fillSprite, out Image fillImage)
        {
            Img(back, "bar_back");
            var fill = Node("Fill", back);
            fill.anchorMin = Vector2.zero;
            fill.anchorMax = new Vector2(0.6f, 1f);
            fill.offsetMin = fill.offsetMax = Vector2.zero;
            fillImage = Img(fill, fillSprite);
            return fill;
        }

        /// <summary>A small coloured square: icon placeholder until the HUD icons exist.</summary>
        static void Icon(Transform parent, string name, Vector2 anchor, Vector2 pos, Color c, float size = 10) =>
            Solid(At(Node(name, parent), anchor, pos, new Vector2(size, size), new Vector2(0, 0.5f)), c);

        // ================= HUD (draft hud3) =================

        static GameObject BuildHud()
        {
            var root = Stretch(Node("Hud", null));
            var view = root.gameObject.AddComponent<HudView>();

            // Top left: place box.
            var place = At(Node("Place", root), TopLeft, new Vector2(12, -12), new Vector2(300, 58));
            Img(place, "box_dark");
            view.place = Txt(At(Node("Name", place), TopLeft, new Vector2(12, -6), new Vector2(276, 22)), "Meydan", 16, Paper, TextAnchor.MiddleLeft, true);
            view.flag = Img(At(Node("Flag", place), TopLeft, new Vector2(12, -32), new Vector2(32, 22)), "flag_tr", Image.Type.Simple);
            view.info = Txt(At(Node("Info", place), TopLeft, new Vector2(52, -31), new Vector2(236, 22)), "", 14, Paper);

            // Top right: Coin, elmas, toz (29.10.2026, Onur). Collection Score is in the profile and the book.
            var bal = At(Node("Balances", root), TopRight, new Vector2(-12, -12), new Vector2(350, 38));
            Img(bal, "box_dark");
            Icon(bal, "CoinIcon", new Vector2(0, 0.5f), new Vector2(14, 0), CoinColour);
            view.coin = Txt(At(Node("Coin", bal), new Vector2(0, 0.5f), new Vector2(30, 0), new Vector2(90, 24), new Vector2(0, 0.5f)), "0", 15, Paper, TextAnchor.MiddleLeft, true);
            Icon(bal, "DiamondIcon", new Vector2(0, 0.5f), new Vector2(128, 0), DiamondColour);
            view.diamond = Txt(At(Node("Diamond", bal), new Vector2(0, 0.5f), new Vector2(144, 0), new Vector2(90, 24), new Vector2(0, 0.5f)), "0", 15, DiamondColour, TextAnchor.MiddleLeft, true);
            Icon(bal, "DustIcon", new Vector2(0, 0.5f), new Vector2(244, 0), DustColour);
            view.dust = Txt(At(Node("Dust", bal), new Vector2(0, 0.5f), new Vector2(260, 0), new Vector2(80, 24), new Vector2(0, 0.5f)), "0", 15, DustColour, TextAnchor.MiddleLeft, true);

            view.miniMap = MiniMap(root);

            // Chat log above the chat line. The text grows up from the bottom and the box masks what
            // is above it: the newest line is always the bottom one (31.10.2026: with Truncate Unity cut
            // the last line, so the log showed the message before the newest one).
            var log = At(Node("ChatLog", root), BottomLeft, new Vector2(505, 84), new Vector2(450, 88));
            Img(log, "box_dark");
            view.chatLogBox = log;
            var logView = Stretch(Node("Viewport", log), 12, 6, 12, 8);
            logView.gameObject.AddComponent<RectMask2D>();
            view.chatLog = Txt(Stretch(Node("Text", logView)), "", 14, Paper, TextAnchor.LowerLeft);
            view.chatLog.lineSpacing = 1.55f;
            view.chatLog.horizontalOverflow = HorizontalWrapMode.Wrap;
            view.chatLog.verticalOverflow = VerticalWrapMode.Overflow;
            view.chatLog.supportRichText = true;
            // Chat controls on the log's top edge, see-through until the pointer is on them (31.10.2026, Onur):
            // + / - makes the log bigger or smaller, x closes it (the chat line stays).
            var controls = At(Node("ChatControls", log), TopRight, new Vector2(-2, 2), new Vector2(46, 20), new Vector2(1, 0));
            var fade = controls.gameObject.AddComponent<CanvasGroup>();
            fade.alpha = 0.55f;
            controls.gameObject.AddComponent<HoverFade>().group = fade;
            view.chatControls = controls.gameObject;
            Button ChatControl(string name, string label, float x)
            {
                var b = Btn(controls, name, "flat", label, 13);
                b.GetComponentInChildren<Text>().color = Paper;
                At((RectTransform)b.transform, BottomLeft, new Vector2(x, 0), new Vector2(22, 20));
                return b;
            }
            view.chatSize = ChatControl("ChatSize", "+", 0);
            view.chatSizeText = view.chatSize.GetComponentInChildren<Text>();
            view.chatClose = ChatControl("ChatClose", "x", 24);

            // XP strip on top of the bar, level tag at its left end.
            var xp = Node("Xp", root);
            xp.anchorMin = new Vector2(0, 0);
            xp.anchorMax = new Vector2(1, 0);
            xp.pivot = new Vector2(0.5f, 0);
            xp.anchoredPosition = new Vector2(0, 58);
            xp.sizeDelta = new Vector2(0, 6);
            Solid(xp, Hex("2e222f"));
            var xpFill = Node("Fill", xp);
            xpFill.anchorMin = Vector2.zero;
            xpFill.anchorMax = new Vector2(0.6f, 1);
            xpFill.offsetMin = new Vector2(0, 1);
            xpFill.offsetMax = new Vector2(0, -1);
            Solid(xpFill, Xp);
            view.xpFill = xpFill;
            var lv = At(Node("Level", root), BottomLeft, new Vector2(8, 58), new Vector2(54, 24));
            Img(lv, "tag_level");
            view.level = Txt(Stretch(Node("Text", lv), 0, 0, 0, 2), "Lv 1", 14, Color.white, TextAnchor.MiddleCenter, true);
            // XP text at the far right above the strip (31.10.2026, Onur).
            view.xpText = Txt(At(Node("XpText", root), BottomRight, new Vector2(-10, 66), new Vector2(260, 16), new Vector2(1, 0)), "", 12, Paper, TextAnchor.MiddleRight, true, true);

            // Bottom bar.
            var bar = Node("Bar", root);
            bar.anchorMin = Vector2.zero;
            bar.anchorMax = new Vector2(1, 0);
            bar.pivot = new Vector2(0.5f, 0);
            bar.anchoredPosition = Vector2.zero;
            bar.sizeDelta = new Vector2(0, 58);
            Img(bar, "hud_bar", Image.Type.Sliced, true);

            // Measured on hud3: bars 16 high at y 32, squares 40x40 at y 12.
            Icon(bar, "EnergyIcon", BottomLeft, new Vector2(24, 40), Gold, 12);
            view.energyFill = Bar(At(Node("Energy", bar), BottomLeft, new Vector2(48, 32), new Vector2(112, 16)), "bar_fill_yellow", out _);
            view.energyText = Txt(At(Node("EnergyText", bar), BottomLeft, new Vector2(48, 10), new Vector2(130, 20)), "Enerji", 13, Paper);

            Icon(bar, "RodIcon", BottomLeft, new Vector2(198, 40), CoinColour, 12);
            view.rodFill = Bar(At(Node("Rod", bar), BottomLeft, new Vector2(220, 32), new Vector2(92, 16)), "bar_fill_green", out view.rodFillImage);
            view.rodGood = S("bar_fill_green");
            view.rodLow = S("bar_fill_red");
            view.rodText = Txt(At(Node("RodText", bar), BottomLeft, new Vector2(220, 10), new Vector2(100, 20)), "Olta", 13, Paper);
            view.repair = Btn(bar, "Repair", "square_green", "Tamir", 10);
            view.repair.GetComponentInChildren<Text>().horizontalOverflow = HorizontalWrapMode.Overflow;
            At((RectTransform)view.repair.transform, BottomLeft, new Vector2(320, 12), new Vector2(40, 40));

            view.bait = Slot(bar, "Bait");
            view.bait.empty = S("button_flat_normal");
            view.bait.frame.pixelsPerUnitMultiplier = 1;
            view.bait.frame.sprite = view.bait.empty;
            view.bait.label.color = Paper;
            At((RectTransform)view.bait.transform, BottomLeft, new Vector2(384, 12), new Vector2(40, 40));
            view.baitText = Txt(At(Node("BaitText", bar), BottomLeft, new Vector2(432, 12), new Vector2(70, 40)), "Yem", 13, Paper);

            // Chat line at x 504, send square beside it. The line stays when the log is closed.
            var group = Stretch(Node("ChatGroup", bar));
            view.chatGroup = group.gameObject;
            var chat = At(Node("Chat", group), BottomLeft, new Vector2(504, 12), new Vector2(400, 40));
            var field = Field(chat, "Enter ile yaz...  /w ad ile fısılda", 14);
            field.characterLimit = 120;
            view.chat = field;
            view.send = Btn(group, "Send", "flat", "↵", 16);
            view.send.GetComponentInChildren<Text>().color = Paper;
            At((RectTransform)view.send.transform, BottomLeft, new Vector2(910, 12), new Vector2(44, 40));

            // Closed log: a small button on the chat line's top-left corner opens it again; red dot = unread.
            view.chatOpen = Btn(root, "ChatOpen", "flat", "^", 12);
            view.chatOpen.GetComponentInChildren<Text>().color = Paper;
            At((RectTransform)view.chatOpen.transform, BottomLeft, new Vector2(505, 58), new Vector2(26, 20));
            var unread = At(Node("Unread", view.chatOpen.transform), TopRight, new Vector2(3, 3), new Vector2(8, 8));
            Solid(unread, Hex("e83b3b"));
            view.chatUnread = unread.gameObject;
            view.chatOpen.gameObject.SetActive(false);

            // Window buttons 40x40, 50 apart, ending at 1280; settings apart at 1350 (hud3).
            // No quest button: the quest window opens at the quest giver NPC (29.10.2026).
            string[] names = { "Emote", "Market", "Friends", "Profile", "Book", "Bag" };
            string[] labels = { "Emote\n(T)", "Pazar\n(M)", "Dost\n(O)", "Profil\n(P)", "Defter\n(K)", "Çanta\n(B)" };
            var buttons = new Button[names.Length];
            for (var i = 0; i < names.Length; i++)
            {
                buttons[i] = Btn(bar, names[i], "flat", labels[i], 10);
                var bl = buttons[i].GetComponentInChildren<Text>();
                bl.color = Paper;
                bl.horizontalOverflow = HorizontalWrapMode.Overflow; // one word per line, never split
                At((RectTransform)buttons[i].transform, BottomRight, new Vector2(-(1408 - 1320 + (names.Length - 1 - i) * 50), 12), new Vector2(48, 40), BottomRight);
            }
            view.emote = buttons[0];
            view.market = buttons[1];
            view.friends = buttons[2];
            view.profile = buttons[3];
            view.book = buttons[4];
            view.bag = buttons[5];
            view.settings = Btn(bar, "Settings", "flat", "Ayar", 10);
            view.settings.GetComponentInChildren<Text>().color = Paper;
            At((RectTransform)view.settings.transform, BottomRight, new Vector2(-(1408 - 1390), 12), new Vector2(40, 40), BottomRight);
            return root.gameObject;
        }

        /// <summary>Mini map under the balances (31.10.2026, Onur) and the "Başlangıca dön" button under it.</summary>
        static MiniMapView MiniMap(RectTransform root)
        {
            var box = At(Node("MiniMap", root), TopRight, new Vector2(-12, -56), new Vector2(176, 136));
            Img(box, "box_dark", Image.Type.Sliced, true);
            var view = box.gameObject.AddComponent<MiniMapView>();
            var area = Stretch(Node("Area", box), 8, 8, 8, 8);
            view.area = area;
            var map = Stretch(Node("Map", area));
            view.map = map.gameObject.AddComponent<RawImage>();
            view.map.raycastTarget = false;
            var markers = Stretch(Node("Markers", area));
            view.markers = markers;

            var m = At(Node("MarkerTemplate", markers), TopLeft, Vector2.zero, new Vector2(12, 12), Center);
            var marker = m.gameObject.AddComponent<MiniMapMarker>();
            marker.rect = m;
            var icon = At(Node("Icon", m), Center, Vector2.zero, new Vector2(10, 10), Center);
            marker.icon = Solid(icon, Color.white);
            marker.letter = Txt(Stretch(Node("Letter", icon)), "", 8, Ink, TextAnchor.MiddleCenter);
            var arrow = At(Node("Arrow", m), Center, Vector2.zero, new Vector2(8, 8), Center);
            marker.arrow = arrow;
            Txt(Stretch(Node("Text", arrow)), ">", 8, Paper, TextAnchor.MiddleCenter, false, true);
            view.markerTemplate = marker;
            m.gameObject.SetActive(false);

            var me = At(Node("Me", markers), TopLeft, Vector2.zero, new Vector2(6, 6), Center);
            Solid(me, Gold);
            Solid(Stretch(Node("Edge", me), -1, -1, -1, -1), Ink).transform.SetAsFirstSibling();
            view.me = me;

            view.home = Btn(root, "Home", "wood", "Başlangıca dön", 10);
            At((RectTransform)view.home.transform, TopRight, new Vector2(-12, -196), new Vector2(176, 24));
            view.homeText = view.home.GetComponentInChildren<Text>();
            return view;
        }

        // ================= Bag (draft canta-v2) =================

        static GameObject BuildBag()
        {
            var wrap = Stretch(Node("Bag", null));
            var view = wrap.gameObject.AddComponent<BagView>();
            // canta-v2: 392 wide, 16 from the right, 81 from the bottom; slots 40 at a 44 pitch from (20, 48).
            view.window = Window(wrap, "Window", "Çanta", new Vector2(392, 309));
            At((RectTransform)view.window.transform, BottomRight, new Vector2(-16, 81), new Vector2(392, 309), BottomRight);
            var body = (RectTransform)view.window.transform;
            Object.DestroyImmediate(view.window.body.gameObject);
            view.window.body = body;
            view.capacity = Txt(At(Node("Capacity", body), TopLeft, new Vector2(22, -20), new Vector2(120, 22)), "0 / 40", 16, Ink);
            view.balance = Txt(At(Node("Balance", body), BottomRight, new Vector2(-22, 16), new Vector2(200, 20)), "", 14, Faint, TextAnchor.MiddleRight);

            var grid = Node("Grid", body);
            grid.anchorMin = new Vector2(0, 0);
            grid.anchorMax = new Vector2(1, 1);
            grid.offsetMin = new Vector2(20, 38);
            grid.offsetMax = new Vector2(-16, -48);
            var layout = grid.gameObject.AddComponent<GridLayoutGroup>();
            layout.cellSize = new Vector2(40, 40);
            layout.spacing = new Vector2(4, 4);
            layout.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            layout.constraintCount = 8;
            view.grid = grid;
            view.slotTemplate = Slot(grid, "SlotTemplate");
            view.slotTemplate.gameObject.SetActive(false);

            view.footer = Txt(At(Node("Footer", body), BottomLeft, new Vector2(22, 16), new Vector2(150, 20)), "Tıkla: işlemler", 14, Faint);
            return wrap.gameObject;
        }

        // ================= Tooltip and right-click menu =================

        static GameObject BuildPopup()
        {
            var root = Stretch(Node("Popup", null));
            var view = root.gameObject.AddComponent<PopupView>();

            var tip = Node("Tooltip", root);
            Img(tip, "tooltip");
            var tipLayout = tip.gameObject.AddComponent<VerticalLayoutGroup>();
            tipLayout.padding = new RectOffset(8, 8, 5, 6);
            tipLayout.childControlWidth = tipLayout.childControlHeight = true;
            tip.gameObject.AddComponent<ContentSizeFitter>().horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            tip.GetComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            view.tooltip = tip;
            view.tooltipText = Label(tip, "Text", "", 13, Paper);
            view.tooltipText.supportRichText = true;

            var menu = Node("Menu", root);
            Img(menu, "menu", Image.Type.Sliced, true);
            var menuLayout = menu.gameObject.AddComponent<VerticalLayoutGroup>();
            menuLayout.padding = new RectOffset(4, 4, 4, 4);
            menuLayout.spacing = 1;
            menuLayout.childControlWidth = menuLayout.childControlHeight = true;
            menuLayout.childForceExpandHeight = false;
            var fit = menu.gameObject.AddComponent<ContentSizeFitter>();
            fit.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
            fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            view.menu = menu;
            view.menuTitle = Label(menu, "Title", "", 13, Paper, TextAnchor.MiddleLeft, true);
            view.menuTitle.gameObject.AddComponent<LayoutElement>().minHeight = 22;
            var menuLine = Node("Divider", menu);
            Img(menuLine, "divider");
            Size(menuLine, minH: 4, prefH: 4);

            var item = Node("Item", menu);
            var hi = Img(item, "menu_highlight", Image.Type.Sliced, true);
            var b = item.gameObject.AddComponent<Button>();
            b.targetGraphic = hi;
            b.transition = Selectable.Transition.ColorTint;
            b.colors = new ColorBlock
            {
                normalColor = new Color(1, 1, 1, 0), highlightedColor = Color.white, pressedColor = new Color(0.85f, 0.85f, 0.85f, 1),
                selectedColor = new Color(1, 1, 1, 0), disabledColor = new Color(1, 1, 1, 0), colorMultiplier = 1, fadeDuration = 0,
            };
            var itemSize = item.gameObject.AddComponent<LayoutElement>();
            itemSize.minHeight = 22;
            itemSize.minWidth = 170;
            var itemText = Txt(Stretch(Node("Label", item), 8, 0, 12, 0), "", 13, Paper);
            itemText.horizontalOverflow = HorizontalWrapMode.Overflow;
            view.itemTemplate = b;
            return root.gameObject;
        }

        // ================= Settings (drafts ayarlar-genel, ayarlar-hesap) =================

        /// <summary>A node at draft coordinates inside a window: x, y from the window's top-left corner.</summary>
        static RectTransform Abs(Transform parent, string name, float x, float y, float w, float h) =>
            At(Node(name, parent), TopLeft, new Vector2(x, -y), new Vector2(w, h));

        /// <summary>Text whose line is centred on draft y.</summary>
        static Text TextAt(Transform parent, string name, string text, float x, float yCenter, float w, int size, Color colour,
            TextAnchor align = TextAnchor.MiddleLeft, bool bold = false) =>
            Txt(Abs(parent, name, x, yCenter - 11, w, 22), text, size, colour, align, bold);

        static void Section(Transform parent, string title, float yCenter, float lineY)
        {
            TextAt(parent, "Section " + title, title, 203, yCenter, 300, 16, Ink, TextAnchor.MiddleLeft, true);
            Img(Abs(parent, "Divider " + title, 203, lineY, 447, 4), "divider");
        }

        static Toggle Check(Transform parent, string name, string label, string hint, float yCenter)
        {
            var rt = Abs(parent, name, 203, yCenter - 12, 440, 24);
            // The whole line is the click area (transparent), so the label toggles too.
            rt.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            var box = At(Node("Box", rt), new Vector2(0, 0.5f), Vector2.zero, new Vector2(24, 24), new Vector2(0, 0.5f));
            var off = Img(box, "checkbox_off", Image.Type.Simple, true);
            var on = Img(Stretch(Node("On", box)), "checkbox_on", Image.Type.Simple);
            var t = rt.gameObject.AddComponent<Toggle>();
            t.targetGraphic = off;
            t.graphic = on;
            t.transition = Selectable.Transition.None;
            var nav = t.navigation;
            nav.mode = Navigation.Mode.None;
            t.navigation = nav;
            var text = Txt(At(Node("Label", rt), new Vector2(0, 0.5f), new Vector2(34, 0), new Vector2(400, 22), new Vector2(0, 0.5f)),
                hint == null ? label : $"{label}  <color=#7f708a>{hint}</color>", 15, Ink);
            text.supportRichText = true;
            return t;
        }

        static Slider SliderAt(Transform parent, string name, float yCenter, out Text value)
        {
            var rt = Abs(parent, name, 327, yCenter - 9, 240, 18);
            var back = Stretch(Node("Back", rt), 0, 1, 0, 1);
            Img(back, "bar_back", Image.Type.Sliced, true);
            var area = Stretch(Node("Fill Area", rt), 0, 1, 0, 1);
            var fill = Node("Fill", area);
            fill.sizeDelta = Vector2.zero;
            Img(fill, "bar_fill_green");
            var handleArea = Stretch(Node("Handle Area", rt), 6, 0, 6, 0);
            var handle = Node("Handle", handleArea);
            handle.sizeDelta = new Vector2(12, 6);
            var hImg = Img(handle, "button_wood_hover", Image.Type.Sliced, true);
            var sl = rt.gameObject.AddComponent<Slider>();
            sl.fillRect = fill;
            sl.handleRect = handle;
            sl.targetGraphic = hImg;
            sl.direction = Slider.Direction.LeftToRight;
            sl.minValue = 0;
            sl.maxValue = 1;
            sl.value = 0.6f;
            var nav = sl.navigation;
            nav.mode = Navigation.Mode.None;
            sl.navigation = nav;
            value = TextAt(parent, name + "Value", "%60", 580, yCenter, 60, 14, Faint);
            return sl;
        }

        /// <summary>A field-look button with "▼": the client cycles its options on click.</summary>
        static Button Choice(Transform parent, string name, float yCenter, out Text label)
        {
            var rt = Abs(parent, name, 327, yCenter - 15, 178, 30);
            var img = Img(rt, "input_normal", Image.Type.Sliced, true);
            var b = rt.gameObject.AddComponent<Button>();
            b.targetGraphic = img;
            b.transition = Selectable.Transition.SpriteSwap;
            b.spriteState = new SpriteState { highlightedSprite = S("input_focus"), pressedSprite = S("input_focus") };
            var nav = b.navigation;
            nav.mode = Navigation.Mode.None;
            b.navigation = nav;
            label = Txt(Stretch(Node("Label", rt), 9, 2, 28, 2), "", 15, Ink);
            Txt(At(Node("Arrow", rt), new Vector2(1, 0.5f), new Vector2(-8, 0), new Vector2(16, 20), new Vector2(1, 0.5f)), "▼", 11, Ink, TextAnchor.MiddleCenter);
            return b;
        }

        static SettingsView.LoginRow LoginRow(Transform parent, string name, Color icon, float top)
        {
            var row = new SettingsView.LoginRow();
            var rt = Abs(parent, "Login " + name, 203, top, 447, 40);
            row.back = Img(rt, "card");
            Img(Stretch(Node("Outline", rt)), "outline");
            Solid(At(Node("Icon", rt), new Vector2(0, 0.5f), new Vector2(10, 0), new Vector2(20, 20), new Vector2(0, 0.5f)), icon);
            Txt(At(Node("Name", rt), new Vector2(0, 0.5f), new Vector2(45, 0), new Vector2(95, 22), new Vector2(0, 0.5f)), name, 16, Ink);
            row.status = Txt(At(Node("Status", rt), new Vector2(0, 0.5f), new Vector2(140, 0), new Vector2(165, 22), new Vector2(0, 0.5f)), "bağlı değil", 14, Faint);
            row.button = Btn(rt, "Button", "wood", "Bağla", 13);
            At((RectTransform)row.button.transform, new Vector2(1, 0.5f), new Vector2(-7, 0), new Vector2(130, 30), new Vector2(1, 0.5f));
            row.buttonText = row.button.GetComponentInChildren<Text>();
            return row;
        }

        static void RecolourButton(Button b, string colour)
        {
            b.GetComponent<Image>().sprite = S($"button_{colour}_normal");
            b.spriteState = new SpriteState
            {
                highlightedSprite = S($"button_{colour}_hover"), pressedSprite = S($"button_{colour}_pressed"),
                selectedSprite = S($"button_{colour}_normal"), disabledSprite = S($"button_{colour}_disabled"),
            };
        }

        static GameObject BuildSettings()
        {
            var size = new Vector2(675, 537);
            var wrap = Stretch(Node("Settings", null));
            var view = wrap.gameObject.AddComponent<SettingsView>();
            view.window = Window(wrap, "Window", "Ayarlar", size);
            At((RectTransform)view.window.transform, Center, new Vector2(-1, 31), size, Center);
            var w = view.window.transform;
            Object.DestroyImmediate(view.window.body.gameObject);
            view.window.body = (RectTransform)w;

            // Left column: tabs, a vertical divider, the version.
            view.tabGeneral = Tab(w, "TabGeneral", "Genel", 23, 32, 152, 36, 16, TextAnchor.MiddleLeft);
            view.tabAccount = Tab(w, "TabAccount", "Hesap", 23, 76, 152, 36, 16, TextAnchor.MiddleLeft);
            var vline = Abs(w, "ColumnDivider", 187, 17, 503, 4);
            Img(vline, "divider");
            vline.pivot = new Vector2(0, 1);
            vline.localEulerAngles = new Vector3(0, 0, -90);
            view.version = TextAt(w, "Version", "v0.4", 23, 501, 160, 13, Faint);

            // ---- Genel ----
            var g = Stretch(Node("General", w));
            view.general = g.gameObject;
            Section(g, "Ses", 42, 57);
            TextAt(g, "MusicLabel", "Müzik", 203, 76, 120, 15, Ink);
            view.music = SliderAt(g, "Music", 77, out view.musicValue);
            TextAt(g, "EffectsLabel", "Efektler", 203, 109, 120, 15, Ink);
            view.effects = SliderAt(g, "Effects", 109, out view.effectsValue);
            view.hitSound = Check(g, "HitSound", "Vuruş sesini her zaman çal", "(müzik kısıksa da)", 143);
            Section(g, "Ekran", 174, 189);
            TextAt(g, "LanguageLabel", "Dil", 203, 214, 120, 15, Ink);
            view.language = Choice(g, "Language", 214, out view.languageText);
            TextAt(g, "ScaleLabel", "Arayüz boyutu", 203, 254, 120, 15, Ink);
            view.uiScale = Choice(g, "UiScale", 254, out view.uiScaleText);
            view.fullScreen = Check(g, "FullScreen", "Tam ekran", "(Steam)", 290);
            view.showNames = Check(g, "ShowNames", "Oyuncu adlarını göster", null, 318);
            Section(g, "Sohbet", 349, 364);
            view.friendsOnly = Check(g, "FriendsOnly", "Sadece arkadaşlardan mesaj al", null, 387);
            view.announcements = Check(g, "Announcements", "Sistem duyurularını göster", "(nadir avlar)", 415);
            view.bubbles = Check(g, "Bubbles", "Sohbet balonları", null, 443);
            view.blocked = TextAt(g, "Blocked", "Engellenenler: 0 kişi", 203, 477, 170, 15, Ink);
            var link = Abs(g, "OpenBlocked", 384, 466, 90, 22);
            var linkText = Txt(link, "Listeyi aç", 15, Hex("4d65b4"));
            linkText.raycastTarget = true;
            view.openBlocked = link.gameObject.AddComponent<Button>();
            view.openBlocked.targetGraphic = linkText;

            // ---- Hesap ----
            // Account > AccountContent (everything on the page; hand-added pieces go here too) and
            // AccountCover on top: opaque, and the content is switched off until "Göster".
            var acc = Stretch(Node("Account", w));
            view.account = acc.gameObject;
            var a = Stretch(Node("AccountContent", acc));
            view.accountContent = a.gameObject;
            Section(a, "Giriş yöntemleri", 42, 57);
            TextAt(a, "Subtitle", "Hepsi aynı karaktere girer. En az biri kalmalı.", 203, 72, 447, 14, Faint);
            view.google = LoginRow(a, "Google", Hex("4d9be6"), 92);
            view.facebook = LoginRow(a, "Facebook", Hex("4d65b4"), 137);
            view.discord = LoginRow(a, "Discord", Hex("a884f3"), 183);
            view.steam = LoginRow(a, "Steam", Hex("2e222f"), 229);
            RecolourButton(view.steam.button, "green");
            var box = Abs(a, "CodeBox", 203, 277, 447, 77);
            Img(box, "box_dark");
            view.codeBox = box.gameObject;
            Txt(At(Node("Title", box), TopLeft, new Vector2(12, -4), new Vector2(420, 20)), "Steam'de bu kodu yaz:", 14, Paper);
            view.code = Txt(At(Node("Code", box), TopLeft, new Vector2(12, -24), new Vector2(130, 24)), "ABCD-EFGH", 18, Gold, TextAnchor.MiddleLeft, true);
            view.codeTimer = Txt(At(Node("Timer", box), TopLeft, new Vector2(142, -26), new Vector2(290, 20)), "", 14, Paper);
            Txt(At(Node("Warn", box), TopLeft, new Vector2(12, -52), new Vector2(420, 20)), "Kimseyle paylaşma. Yetkililer asla istemez.", 14, Hex("e83b3b"));
            Section(a, "Hesap", 379, 394);
            view.username = TextAt(a, "Username", "Kullanıcı adı:", 203, 418, 220, 15, Ink);
            TextAt(a, "Fixed", "(değişmez)", 425, 418, 120, 14, Faint);
            view.logout = Btn(a, "Logout", "wood", "Çıkış yap", 15);
            At((RectTransform)view.logout.transform, TopLeft, new Vector2(203, -437), new Vector2(159, 33));
            view.delete = Btn(a, "Delete", "red", "Hesabı sil", 15);
            At((RectTransform)view.delete.transform, TopLeft, new Vector2(471, -437), new Vector2(179, 33));
            view.deleteNote = TextAt(a, "DeleteNote", "Silme 14 gün bekler, bu sürede geri alınır.", 300, 486, 343, 14, Hex("e83b3b"), TextAnchor.MiddleRight);
            view.error = TextAt(a, "Error", "", 203, 504, 447, 13, Hex("9e4539"));

            // Two-step delete: type the username (replaces the buttons while open).
            var c = Abs(a, "Confirm", 203, 430, 447, 66);
            Img(c, "card");
            view.confirm = c.gameObject;
            Txt(At(Node("Text", c), TopLeft, new Vector2(8, -3), new Vector2(430, 20)), "Her şey kalıcı olarak gider. Onay için kullanıcı adını aynen yaz:", 13, Ink);
            var nameField = At(Node("Name", c), TopLeft, new Vector2(8, -28), new Vector2(170, 30));
            view.confirmName = Field(nameField, "kullanıcı adı", 14);
            view.confirmCancel = Btn(c, "Cancel", "wood", "Vazgeç", 14);
            At((RectTransform)view.confirmCancel.transform, TopLeft, new Vector2(186, -28), new Vector2(110, 30));
            view.confirmDelete = Btn(c, "Confirm", "red", "Hesabımı sil", 14);
            At((RectTransform)view.confirmDelete.transform, TopLeft, new Vector2(304, -28), new Vector2(135, 30));
            c.gameObject.SetActive(false);

            // Pending deletion line (replaces the buttons while a deletion waits).
            view.pending = TextAt(a, "Pending", "", 203, 452, 300, 14, Hex("9e4539"));
            view.pending.horizontalOverflow = HorizontalWrapMode.Wrap;
            view.cancelDeletion = Btn(a, "CancelDeletion", "green", "Silmeyi iptal et", 14);
            At((RectTransform)view.cancelDeletion.transform, TopLeft, new Vector2(510, -437), new Vector2(140, 33));
            view.pending.gameObject.SetActive(false);
            view.cancelDeletion.gameObject.SetActive(false);

            // AccountCover: the account page opens behind it every time.
            var cover = Abs(acc, "AccountCover", 203, 30, 447, 480);
            Img(cover, "panel_cover", Image.Type.Sliced, true);
            view.hidden = cover.gameObject;
            Txt(At(Node("Title", cover), Center, new Vector2(0, 40), new Vector2(400, 24), Center), "Hesap bilgilerin gizlendi", 17, Paper, TextAnchor.MiddleCenter, true);
            var hint = Txt(At(Node("Hint", cover), Center, new Vector2(0, 5), new Vector2(380, 40), Center),
                "Yayın yapıyorsan ya da yanında biri varsa açma.\nBu sayfada hesabını taşıyan kod ve silme ayarı var.", 14, Paper, TextAnchor.MiddleCenter);
            hint.horizontalOverflow = HorizontalWrapMode.Wrap;
            view.reveal = Btn(cover, "Reveal", "wood", "Göster", 15);
            At((RectTransform)view.reveal.transform, Center, new Vector2(0, -45), new Vector2(120, 32), Center);
            return wrap.gameObject;
        }

        // ================= Trade (drafts takas-a, takas-b, takas-c) =================

        static TradeView.Side TradeSide(Transform w, string name, float x, bool mine)
        {
            var side = new TradeView.Side();
            var panel = Abs(w, name, x, 30, 195, 268);
            side.back = Img(panel, "outline");
            side.name = TextAt(panel, "Name", "Sen", 12, 18, 110, 16, Ink);
            side.level = TextAt(panel, "Level", "", 72, 19, 100, 13, Faint);
            side.slots = new SlotView[8];
            for (var i = 0; i < 8; i++)
            {
                var slot = Slot(panel, "Slot" + i);
                At((RectTransform)slot.transform, TopLeft, new Vector2(12 + i % 4 * 44, -(36 + i / 4 * 44)), new Vector2(40, 40));
                side.slots[i] = slot;
            }
            side.count = TextAt(panel, "Count", "0 / 8 eşya", 12, 141, 170, 14, Faint);
            TextAt(panel, "CoinLabel", "Coin", 12, 168, 100, 14, Ink);
            var field = Abs(panel, "Coin", 12, 181, 171, 30);
            side.coin = Field(field, "0", 15);
            field.GetComponent<Image>().sprite = S("input_focus"); // gold edge: Coin
            side.coin.contentType = mine ? InputField.ContentType.IntegerNumber : InputField.ContentType.Standard;
            side.coin.characterLimit = 10;
            ((RectTransform)side.coin.textComponent.transform).offsetMin = new Vector2(28, 1);
            ((RectTransform)side.coin.placeholder.transform).offsetMin = new Vector2(28, 1);
            Icon(field, "CoinIcon", new Vector2(0, 0.5f), new Vector2(8, 0), CoinColour, 12);
            side.coin.interactable = mine;
            side.status = TextAt(panel, "Status", "", 12, 234, 170, 15, Hex("7a3045"));
            return side;
        }

        static GameObject BuildTrade()
        {
            // takas-a: window 465x418 at (510, 262) on the 1408x896 draft.
            var size = new Vector2(465, 418);
            var wrap = Stretch(Node("Trade", null));
            var view = wrap.gameObject.AddComponent<TradeView>();
            view.window = Window(wrap, "Window", "Takas", size);
            At((RectTransform)view.window.transform, Center, new Vector2(38, -23), size, Center);
            var w = view.window.transform;
            Object.DestroyImmediate(view.window.body.gameObject);
            view.window.body = (RectTransform)w;
            view.open = S("outline");
            view.locked = S("panel_locked");
            view.me = TradeSide(w, "Me", 22, true);
            view.them = TradeSide(w, "Them", 250, false);

            view.hint = TextAt(w, "Hint", "Çantadan sürükle bırak. Bir şey değişirse kilitler açılır.", 22, 345, 423, 14, Faint, TextAnchor.MiddleCenter);
            var strip = Abs(w, "Strip", 22, 334, 423, 24);
            Img(strip, "box_dark");
            view.strip = strip.gameObject;
            view.stripText = Txt(Stretch(Node("Text", strip)), "", 14, Hex("fbff86"), TextAnchor.MiddleCenter, true);
            strip.gameObject.SetActive(false);

            view.lockButton = Btn(w, "Lock", "wood", "Kilitle", 16);
            At((RectTransform)view.lockButton.transform, TopLeft, new Vector2(22, -366), new Vector2(138, 40));
            view.lockText = view.lockButton.GetComponentInChildren<Text>();
            view.confirm = Btn(w, "Confirm", "green", "Onayla", 16);
            At((RectTransform)view.confirm.transform, TopLeft, new Vector2(175, -366), new Vector2(157, 40));
            view.confirmText = view.confirm.GetComponentInChildren<Text>();
            view.cancel = Btn(w, "Cancel", "red", "İptal", 16);
            At((RectTransform)view.cancel.transform, TopLeft, new Vector2(336, -366), new Vector2(109, 40));
            return wrap.gameObject;
        }

        static GameObject BuildCount()
        {
            // takas-b: the "Kaç tane?" box, 296x150 at (590, 392).
            var size = new Vector2(296, 150);
            var wrap = Stretch(Node("Count", null));
            var view = wrap.gameObject.AddComponent<CountView>();
            // takas-b dims what is behind the question (and catches clicks there).
            var dim = Stretch(Node("Dim", wrap));
            Img(dim, "box_dark", Image.Type.Sliced, true);
            view.dim = dim.gameObject;
            view.window = Window(wrap, "Window", "", size);
            Object.DestroyImmediate(view.window.plate.gameObject);
            Object.DestroyImmediate(view.window.close.gameObject);
            At((RectTransform)view.window.transform, Center, new Vector2(34, -19), size, Center);
            var w = view.window.transform;
            Object.DestroyImmediate(view.window.body.gameObject);
            view.window.body = (RectTransform)w;
            view.question = TextAt(w, "Question", "Kaç tane?", 26, 34, 250, 16, Ink);
            view.minus = Btn(w, "Minus", "wood", "-", 18);
            At((RectTransform)view.minus.transform, TopLeft, new Vector2(34, -56), new Vector2(38, 32));
            var field = Abs(w, "Value", 98, 56, 98, 32);
            view.value = Field(field, "1", 16);
            field.GetComponent<Image>().sprite = S("input_focus");
            view.value.contentType = InputField.ContentType.IntegerNumber;
            view.value.characterLimit = 6;
            view.value.textComponent.alignment = TextAnchor.MiddleCenter;
            view.plus = Btn(w, "Plus", "wood", "+", 18);
            At((RectTransform)view.plus.transform, TopLeft, new Vector2(222, -56), new Vector2(38, 32));
            view.ok = Btn(w, "Ok", "green", "Tamam", 15);
            At((RectTransform)view.ok.transform, TopLeft, new Vector2(34, -100), new Vector2(106, 34));
            view.cancel = Btn(w, "Cancel", "wood", "Vazgeç", 15);
            At((RectTransform)view.cancel.transform, TopLeft, new Vector2(154, -100), new Vector2(106, 34));
            return wrap.gameObject;
        }

        // ================= Market (drafts tezgah-kur, tezgah-tezgah, tezgah-pano) =================

        /// <summary>A window placed at its draft rectangle (x, y, w, h on the 1408x896 draft), with no body: children use draft coordinates.</summary>
        static WindowView DraftWindow(Transform wrap, string title, float x, float y, float w, float h)
        {
            var view = Window(wrap, "Window", title, new Vector2(w, h));
            At((RectTransform)view.transform, Center, new Vector2(x + w / 2f - 704f, 448f - (y + h / 2f)), new Vector2(w, h), Center);
            Object.DestroyImmediate(view.body.gameObject);
            view.body = (RectTransform)view.transform;
            return view;
        }

        static PriceTag Tag(Transform parent, float x, float y, float w = 48)
        {
            var rt = Abs(parent, "Price", x, y, w, 16);
            Img(rt, "box_dark");
            Icon(rt, "Coin", new Vector2(0, 0.5f), new Vector2(4, 0), Gold, 8);
            var tag = rt.gameObject.AddComponent<PriceTag>();
            tag.text = Txt(Stretch(Node("Text", rt), 14, 0, 2, 0), "0", 12, Paper, TextAnchor.MiddleLeft, true);
            return tag;
        }

        static SlotView SlotAt(Transform parent, string name, float x, float y, float size = 40)
        {
            var slot = Slot(parent, name, size);
            At((RectTransform)slot.transform, TopLeft, new Vector2(x, -y), new Vector2(size, size));
            return slot;
        }

        static GameObject BuildStallSetup()
        {
            // tezgah-kur: window 756x496 at (324, 128).
            var wrap = Stretch(Node("StallSetup", null));
            var view = wrap.gameObject.AddComponent<StallSetupView>();
            view.window = DraftWindow(wrap, "Tezgah kur", 324, 128, 756, 496);
            var w = view.window.transform;
            TextAt(w, "TitleLabel", "Başlık", 28, 47, 70, 15, Ink);
            view.title = Field(Abs(w, "Title", 96, 32, 300, 31), "Tezgahına bir başlık yaz", 15);
            view.title.characterLimit = 40;
            Img(Abs(w, "Divider", 28, 75, 700, 4), "divider");
            view.stallHeader = TextAt(w, "StallHeader", "Tezgah · 0 / 12", 28, 96, 180, 16, Ink, TextAnchor.MiddleLeft, true);
            view.stallHint = TextAt(w, "StallHint", "Çantadan tıkla, fiyat yaz, Koy", 214, 96, 260, 14, Faint);
            view.stall = new SlotView[12];
            view.tags = new PriceTag[12];
            for (var i = 0; i < 12; i++)
            {
                var x = 28 + i % 6 * 68;
                var y = 112 + i / 6 * 68;
                view.stall[i] = SlotAt(w, "Stall" + i, x, y);
                view.tags[i] = Tag(w, x - 2, y + 44);
            }

            var picked = Abs(w, "Picked", 448, 105, 218, 129);
            Img(picked, "box_dark");
            view.picked = picked.gameObject;
            view.pickedName = TextAt(picked, "Name", "", 12, 16, 150, 15, Paper, TextAnchor.MiddleLeft, true);
            view.pickedCondition = TextAt(picked, "Condition", "", 12, 35, 190, 14, DiamondColour);
            view.countLabel = TextAt(picked, "CountLabel", "Adet", 120, 35, 40, 13, Paper);
            view.count = Field(Abs(picked, "Count", 158, 24, 48, 24), "1", 14);
            view.count.contentType = InputField.ContentType.IntegerNumber;
            view.count.characterLimit = 6;
            TextAt(picked, "PriceLabel", "Fiyat", 12, 61, 50, 15, Paper);
            var priceField = Abs(picked, "Price", 61, 47, 98, 27);
            view.price = Field(priceField, "0", 15);
            priceField.GetComponent<Image>().sprite = S("input_focus");
            view.price.contentType = InputField.ContentType.IntegerNumber;
            view.price.characterLimit = 10;
            Icon(picked, "Coin", new Vector2(0, 1), new Vector2(166, -61), Gold, 12);
            view.put = Btn(picked, "Put", "green", "Koy", 15);
            At((RectTransform)view.put.transform, TopLeft, new Vector2(13, -87), new Vector2(93, 30));
            view.takeBack = Btn(picked, "TakeBack", "wood", "Geri al", 15);
            At((RectTransform)view.takeBack.transform, TopLeft, new Vector2(113, -87), new Vector2(93, 30));

            TextAt(w, "BagLabel", "Çanta", 28, 274, 60, 16, Ink, TextAnchor.MiddleLeft, true);
            view.bagHint = TextAt(w, "BagHint", "kilitli eşya konamaz", 96, 274, 200, 14, Faint);
            view.place = TextAt(w, "Place", "", 499, 272, 230, 14, Faint);
            // Bag: 10 a row, two rows in sight, the rest scrolls.
            var scroll = Abs(w, "Bag", 28, 287, 462, 86);
            var sr = scroll.gameObject.AddComponent<ScrollRect>();
            sr.horizontal = false;
            sr.movementType = ScrollRect.MovementType.Clamped;
            sr.scrollSensitivity = 30;
            var viewport = Stretch(Node("Viewport", scroll));
            viewport.gameObject.AddComponent<RectMask2D>();
            viewport.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            var content = Node("Content", viewport);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = content.offsetMax = Vector2.zero;
            var grid = content.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(40, 40);
            grid.spacing = new Vector2(6, 6);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 10;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.viewport = viewport;
            sr.content = content;
            view.bagGrid = content;
            view.bagTemplate = Slot(content, "SlotTemplate");
            view.bagTemplate.gameObject.SetActive(false);

            view.footer = TextAt(w, "Footer", "Pet sen oyundan çıkana kadar satar, sen balık tutarken de.\nSatıştan pazar ücreti kesilir · satılmayanlar çantana döner.", 28, 437, 500, 14, Faint);
            view.footer.horizontalOverflow = HorizontalWrapMode.Wrap;
            ((RectTransform)view.footer.transform).sizeDelta = new Vector2(500, 40);
            view.open = Btn(w, "Open", "green", "Tezgahı aç", 16);
            At((RectTransform)view.open.transform, TopLeft, new Vector2(553, -417), new Vector2(178, 37));
            view.recall = Btn(w, "Recall", "red", "Peti geri çağır", 15);
            At((RectTransform)view.recall.transform, TopLeft, new Vector2(553, -417), new Vector2(178, 37));
            view.board = Btn(w, "Board", "wood", "Pazar Panosu", 15);
            At((RectTransform)view.board.transform, TopLeft, new Vector2(553, -372), new Vector2(178, 34));
            return wrap.gameObject;
        }

        static GameObject BuildStallList()
        {
            // tezgah-tezgah: window 750x420 at (325, 140).
            var wrap = Stretch(Node("Stall", null));
            var view = wrap.gameObject.AddComponent<StallListView>();
            view.window = DraftWindow(wrap, "Tezgah", 325, 140, 750, 420);
            var w = view.window.transform;
            view.pet = SlotAt(w, "Pet", 27, 32, 54);
            view.title = TextAt(w, "Title", "", 95, 44, 360, 18, Ink, TextAnchor.MiddleLeft, true);
            view.owner = TextAt(w, "Owner", "", 95, 66, 360, 14, Faint);
            view.profile = Btn(w, "Profile", "wood", "Profil", 15);
            At((RectTransform)view.profile.transform, TopLeft, new Vector2(460, -37), new Vector2(85, 30));
            view.whisper = Btn(w, "Whisper", "wood", "Fısılda", 15);
            At((RectTransform)view.whisper.transform, TopLeft, new Vector2(552, -37), new Vector2(86, 30));
            view.friend = Btn(w, "Friend", "green", "Arkadaş", 15);
            At((RectTransform)view.friend.transform, TopLeft, new Vector2(644, -37), new Vector2(86, 30));
            view.slots = new SlotView[12];
            view.tags = new PriceTag[12];
            for (var i = 0; i < 12; i++)
            {
                var x = 27 + i % 4 * 68;
                var y = 112 + i / 4 * 72;
                view.slots[i] = SlotAt(w, "Slot" + i, x, y);
                view.tags[i] = Tag(w, x - 2, y + 44);
            }

            var card = Abs(w, "Detail", 320, 113, 410, 207);
            Img(card, "card");
            view.detail = card.gameObject;
            view.detailSlot = SlotAt(card, "Item", 15, 15);
            view.detailName = TextAt(card, "Name", "", 68, 25, 320, 16, Ink, TextAnchor.MiddleLeft, true);
            view.detailSub = TextAt(card, "Sub", "", 68, 45, 330, 14, Faint);
            TextAt(card, "UnitLabel", "Tanesi", 15, 80, 60, 15, Ink);
            Icon(card, "UnitCoin", new Vector2(0, 1), new Vector2(75, -80), Gold, 12);
            view.unitPrice = TextAt(card, "Unit", "", 92, 80, 200, 16, Ink, TextAnchor.MiddleLeft, true);
            var row = Abs(card, "CountRow", 0, 100, 410, 30);
            view.countRow = row.gameObject;
            view.countLabel = TextAt(row, "Label", "Kaç tane?", 15, 15, 75, 15, Ink);
            view.minus = Btn(row, "Minus", "wood", "-", 16);
            At((RectTransform)view.minus.transform, TopLeft, new Vector2(92, -2), new Vector2(30, 26));
            view.count = Field(Abs(row, "Count", 127, 2, 64, 26), "1", 15);
            view.count.contentType = InputField.ContentType.IntegerNumber;
            view.count.characterLimit = 6;
            view.plus = Btn(row, "Plus", "wood", "+", 16);
            At((RectTransform)view.plus.transform, TopLeft, new Vector2(196, -2), new Vector2(30, 26));
            var max = Abs(row, "Max", 234, 4, 40, 22);
            var maxText = Txt(max, "max", 14, Hex("4d65b4"));
            maxText.raycastTarget = true;
            view.max = max.gameObject.AddComponent<Button>();
            view.max.targetGraphic = maxText;
            TextAt(card, "TotalLabel", "Toplam", 15, 151, 60, 15, Ink);
            Icon(card, "TotalCoin", new Vector2(0, 1), new Vector2(75, -151), Gold, 12);
            view.total = TextAt(card, "Total", "", 92, 151, 200, 16, Ink, TextAnchor.MiddleLeft, true);
            view.buy = Btn(card, "Buy", "green", "Satın al", 16);
            At((RectTransform)view.buy.transform, TopLeft, new Vector2(15, -167), new Vector2(380, 32));
            view.buyText = view.buy.GetComponentInChildren<Text>();
            view.note = TextAt(w, "Note", "Float'lı eşyada Float ve\nkondisyon burada yazar.", 320, 349, 400, 14, Faint);
            ((RectTransform)view.note.transform).sizeDelta = new Vector2(400, 40);
            view.footer = TextAt(w, "Footer", "", 27, 388, 600, 14, Faint);
            return wrap.gameObject;
        }

        static GameObject BuildBoard()
        {
            // tezgah-pano: window 835x586 at (285, 112).
            var wrap = Stretch(Node("Board", null));
            var view = wrap.gameObject.AddComponent<BoardView>();
            view.window = DraftWindow(wrap, "Pazar Panosu", 285, 112, 835, 586);
            var w = view.window.transform;
            Icon(w, "DiamondIcon", new Vector2(0, 1), new Vector2(30, -43), DiamondColour, 10);
            view.hint = TextAt(w, "Hint", "Reklamlar sırayla döner · tıkla, tezgahın yanına git", 50, 43, 600, 14, Faint);
            view.cards = new BoardView.Card[4];
            for (var i = 0; i < 4; i++)
            {
                var c = new BoardView.Card();
                var rt = Abs(w, "Card" + i, 28 + i % 2 * 400, 66 + i / 2 * 184, 384, 170);
                Img(rt, "card");
                c.root = rt.gameObject;
                c.pet = SlotAt(rt, "Pet", 15, 10, 30);
                c.title = TextAt(rt, "Title", "", 52, 20, 320, 16, Ink, TextAnchor.MiddleLeft, true);
                c.owner = TextAt(rt, "Owner", "", 52, 40, 320, 14, Faint);
                c.slots = new SlotView[3];
                c.tags = new PriceTag[3];
                for (var j = 0; j < 3; j++)
                {
                    c.slots[j] = SlotAt(rt, "Slot" + j, 15 + j * 72, 62);
                    c.tags[j] = Tag(rt, 13 + j * 72, 108, 52);
                }
                c.go = Btn(rt, "Go", "green", "Yanına git", 15);
                At((RectTransform)c.go.transform, TopLeft, new Vector2(232, -127), new Vector2(135, 31));
                view.cards[i] = c;
            }
            view.empty = TextAt(w, "Empty", "Panoda ilan yok.", 28, 160, 780, 16, Ink, TextAnchor.MiddleCenter);
            var foot = TextAt(w, "Footer", "Tezgahın açıkken kendini burada ilan edebilirsin.\n<color=#7f708a>İlan tezgah kalkınca kalkar. Eşya miktarı ya da kalitesi değişmez.</color>", 28, 520, 560, 14, Ink);
            foot.supportRichText = true;
            ((RectTransform)foot.transform).sizeDelta = new Vector2(560, 40);
            view.advertise = Btn(w, "Advertise", "wood", "Reklam ver", 16);
            At((RectTransform)view.advertise.transform, TopLeft, new Vector2(620, -510), new Vector2(190, 36));
            view.advertiseText = view.advertise.GetComponentInChildren<Text>();
            return wrap.gameObject;
        }

        // ================= Daily quests (draft npc-gorev) =================

        static QuestView.Row QuestRow(Transform w, string name, float y, bool button)
        {
            var row = new QuestView.Row();
            var rt = Abs(w, name, 28, y, 906, 90);
            Img(rt, "card");
            Img(Stretch(Node("Outline", rt)), "outline");
            row.root = rt.gameObject;
            row.icon = SlotAt(rt, "Icon", 12, 22, 42);
            row.icon.label.SetSize(11);
            row.title = TextAt(rt, "Title", "", 68, 24, 520, 16, Ink);
            var back = Abs(rt, "Bar", 68, 44, 220, 12);
            row.fill = Bar(back, "bar_fill_green", out _);
            row.count = TextAt(rt, "Count", "", 301, 50, 90, 14, Faint);
            row.reward = TextAt(rt, "Reward", "", 68, 71, 520, 14, Faint);
            row.reward.supportRichText = true;
            row.state = TextAt(rt, "State", "", 608, 38, 280, 16, Hex("1e6f50"), TextAnchor.MiddleRight, true);
            if (button)
            {
                row.button = Btn(rt, "Button", "green", "Sandığı aç", 16);
                At((RectTransform)row.button.transform, TopLeft, new Vector2(752, -20), new Vector2(140, 36));
                row.buttonText = row.button.GetComponentInChildren<Text>();
            }
            return row;
        }

        static GameObject BuildQuests()
        {
            // npc-gorev: window 956x594 at (224, 106); quest cards 906x90, 100 apart from y 114.
            var wrap = Stretch(Node("Quests", null));
            var view = wrap.gameObject.AddComponent<QuestView>();
            view.window = DraftWindow(wrap, "Görevler", 224, 106, 956, 594);
            var w = view.window.transform;
            Icon(w, "CoinIcon", new Vector2(0, 1), new Vector2(766, -42), Gold, 14);
            view.coin = TextAt(w, "Coin", "0", 786, 42, 100, 16, Ink, TextAnchor.MiddleLeft, true);
            Icon(w, "DiamondIcon", new Vector2(0, 1), new Vector2(866, -42), DiamondColour, 12);
            view.diamond = TextAt(w, "Diamond", "0", 884, 42, 60, 16, Hex("4d9be6"), TextAnchor.MiddleLeft, true);
            view.header = TextAt(w, "Header", "Bugünün görevleri", 29, 92, 220, 17, Ink);
            view.hint = TextAt(w, "Hint", "", 229, 92, 480, 14, Faint);
            view.quests = new QuestView.Row[3];
            for (var i = 0; i < 3; i++) view.quests[i] = QuestRow(w, "Quest" + i, 114 + i * 100, false);
            view.chest = QuestRow(w, "Chest", 414, true);
            view.barDone = S("bar_fill_green");
            view.barGoing = S("bar_fill_yellow");
            view.footer = TextAt(w, "Footer", "Görevler gece yarısı yenilenir. Sandık üç görev bitince açılır; içinden Coin, toz, yem ya da recipe çıkar.\nSeri: her gün sandığı alırsan büyür, bir gün kaçırırsan biraz geri düşer.", 29, 535, 900, 14, Faint);
            ((RectTransform)view.footer.transform).sizeDelta = new Vector2(900, 40);
            return wrap.gameObject;
        }

        // ================= Collection Book (draft defter-v2) =================

        static Button LinkText(Transform parent, string name, string text, float x, float yc, float w, Color colour, TextAnchor align = TextAnchor.MiddleLeft)
        {
            var t = TextAt(parent, name, text, x, yc, w, 15, colour, align);
            t.raycastTarget = true;
            var b = t.gameObject.AddComponent<Button>();
            b.targetGraphic = t;
            var nav = b.navigation;
            nav.mode = Navigation.Mode.None;
            b.navigation = nav;
            return b;
        }

        static GameObject BuildBook()
        {
            // defter-v2: window 676x408 at (192, 104); pages 305x278 at x 26 / 349, y 58; cards 80x80, 100 apart.
            var wrap = Stretch(Node("Book", null));
            var view = wrap.gameObject.AddComponent<BookView>();
            view.window = DraftWindow(wrap, "Koleksiyon", 192, 104, 676, 408);
            var w = view.window.transform;
            view.owner = TextAt(w, "Owner", "Defter", 30, 37, 160, 20, Ink, TextAnchor.MiddleLeft, true);
            TextAt(w, "TotalLabel", "toplam", 113, 37, 70, 14, Faint);
            view.totalFill = Bar(Abs(w, "Total", 193, 30, 158, 15), "bar_fill_green", out _);
            view.totalText = TextAt(w, "TotalText", "", 361, 37, 70, 14, Ink);
            view.luck = TextAt(w, "Luck", "", 429, 37, 90, 14, Hex("1e6f50"));
            Icon(w, "ScoreIcon", new Vector2(0, 1), new Vector2(525, -37), Gold, 14);
            view.score = TextAt(w, "Score", "", 545, 37, 100, 15, Hex("e83b3b"), TextAnchor.MiddleLeft, true);
            view.tierFrames = new[] { S("record_common"), S("record_rare"), S("record_epic"), S("record_legendary"), S("record_mythic") };
            view.found = S("record_found");
            view.unknown = S("record_unknown");
            Img(Abs(w, "Spine", 331, 58, 18, 278), "box_dark");
            view.pages = new BookView.Page[2];
            for (var p = 0; p < 2; p++)
            {
                var pg = Abs(w, "Page" + p, 26 + p * 323, 58, 305, 278);
                Img(pg, "card");
                Img(Stretch(Node("Outline", pg)), "outline");
                var page = new BookView.Page
                {
                    title = TextAt(pg, "Title", "", 12, 16, 200, 16, Ink),
                    count = TextAt(pg, "Count", "", 190, 16, 103, 14, Ink, TextAnchor.MiddleRight),
                    cards = new BookView.Card[6],
                };
                Img(Abs(pg, "Divider", 10, 30, 285, 4), "divider");
                for (var i = 0; i < 6; i++)
                {
                    var x = 10 + i % 3 * 100;
                    var y = 38 + i / 3 * 116;
                    var cardRt = Abs(pg, "Card" + i, x, y, 80, 80);
                    var card = new BookView.Card { frame = Img(cardRt, "record_unknown", Image.Type.Sliced, true) };
                    card.mark = Txt(Stretch(Node("Mark", cardRt), 4, 4, 4, 4), "??", 15, Ink, TextAnchor.MiddleCenter, true);
                    card.name = TextAt(pg, "Name" + i, "", x - 10, y + 96, 100, 13, Ink, TextAnchor.MiddleCenter);
                    card.name.horizontalOverflow = HorizontalWrapMode.Wrap;
                    var badge = At(Node("New", cardRt), TopRight, new Vector2(4, 6), new Vector2(36, 16));
                    Img(badge, "button_red_normal");
                    Txt(Stretch(Node("Text", badge)), "Yeni", 11, Color.white, TextAnchor.MiddleCenter, true);
                    card.newBadge = badge.gameObject;
                    badge.gameObject.SetActive(false);
                    card.hover = cardRt.gameObject.AddComponent<CardHover>();
                    page.cards[i] = card;
                }
                view.pages[p] = page;
            }
            view.prev = LinkText(w, "Prev", "<", 250, 349, 20, Ink, TextAnchor.MiddleCenter);
            view.nav = TextAt(w, "Nav", "", 270, 349, 136, 14, Faint, TextAnchor.MiddleCenter);
            view.next = LinkText(w, "Next", ">", 406, 349, 20, Ink, TextAnchor.MiddleCenter);
            return wrap.gameObject;
        }

        // ================= Profile card (draft profil-v3) =================

        static void Stat(Transform w, int i, out Text label, out Text value)
        {
            var rt = Abs(w, "Stat" + i, 29 + i * 160, 315, 146, 44);
            Img(rt, "card");
            Img(Stretch(Node("Outline", rt)), "outline");
            label = TextAt(rt, "Label", "", 10, 11, 130, 14, Ink);
            value = TextAt(rt, "Value", "", 10, 30, 70, 15, Ink, TextAnchor.MiddleLeft, true);
        }

        static GameObject BuildProfile()
        {
            // profil-v3: window 520x460 at (300, 128).
            var wrap = Stretch(Node("Profile", null));
            var view = wrap.gameObject.AddComponent<ProfileView>();
            view.window = DraftWindow(wrap, "Profil", 300, 128, 520, 460);
            var w = view.window.transform;
            // Portrait: the character as it looks now, head and shoulders in a slot frame (31.10.2026, Onur).
            var frame = Abs(w, "Portrait", 28, 28, 104, 104);
            Img(frame, "slot_empty").pixelsPerUnitMultiplier = 1;
            var holder = Stretch(Node("Character", frame), 4, 4, 4, 4);
            holder.gameObject.AddComponent<RectMask2D>();
            view.portrait = frame.gameObject.AddComponent<CharacterPortrait>();
            view.portrait.holder = holder;

            // Name and level tag in a row: the tag follows the name, never on it.
            var nameRow = Row(w, "NameRow", 145, 30, 340, 24, 10);
            view.displayName = Txt(Node("Name", nameRow), "", 21, Ink);
            view.levelTag = LevelTag(nameRow, out view.level).gameObject;
            view.sub = TextAt(w, "Sub", "", 145, 73, 330, 14, Faint);
            var scoreRow = Row(w, "ScoreRow", 145, 95, 340, 22, 8);
            Size(Solid(Node("ScoreIcon", scoreRow), Gold), 16, 16, 16, 16);
            view.score = Txt(Node("Score", scoreRow), "0", 19, Hex("e83b3b"));
            Txt(Node("ScoreLabel", scoreRow), "Collection Score", 15, Ink);
            var hunt = Abs(w, "Hunt", 144, 126, 351, 26);
            Img(hunt, "panel_alert");
            view.hunt = hunt.gameObject;
            view.huntText = Txt(Stretch(Node("Text", hunt), 10, 0, 8, 0), "", 14, Hex("ae2334"));
            TextAt(w, "ShowcaseLabel", "Vitrin", 29, 176, 100, 14, Ink);
            Img(Abs(w, "ShowcaseLine", 29, 186, 466, 4), "divider");
            view.showcase = new SlotView[3];
            for (var i = 0; i < 3; i++)
            {
                view.showcase[i] = SlotAt(w, "Showcase" + i, 110 + i * 112, 192, 80);
                view.showcase[i].frame.pixelsPerUnitMultiplier = 1;
                view.showcase[i].label.SetSize(14);
            }
            TextAt(w, "CollectionLabel", "Koleksiyon", 29, 300, 120, 14, Ink);
            Stat(w, 0, out view.stat1Label, out view.stat1Value);
            view.stat1Fill = Bar(Abs(w.Find("Stat0"), "Bar", 76, 24, 60, 12), "bar_fill_green", out _);
            Stat(w, 1, out view.stat2Label, out view.stat2Value);
            Stat(w, 2, out view.stat3Label, out view.stat3Value);
            view.book = Btn(w, "Book", "wood", "Defterine bak", 14);
            At((RectTransform)view.book.transform, TopLeft, new Vector2(29, -384), new Vector2(141, 30));
            view.bookText = view.book.GetComponentInChildren<Text>();
            view.whisper = Btn(w, "Whisper", "wood", "Fısılda", 14);
            At((RectTransform)view.whisper.transform, TopLeft, new Vector2(177, -384), new Vector2(101, 30));
            view.friend = Btn(w, "Friend", "green", "Arkadaş ekle", 14);
            At((RectTransform)view.friend.transform, TopLeft, new Vector2(289, -384), new Vector2(121, 30));
            view.trade = Btn(w, "Trade", "wood", "Takas", 14);
            At((RectTransform)view.trade.transform, TopLeft, new Vector2(421, -384), new Vector2(70, 30));
            view.footer = TextAt(w, "Footer", "", 29, 428, 300, 13, Faint);
            view.report = LinkText(w, "Report", "Raporla", 378, 428, 60, Hex("e83b3b"), TextAnchor.MiddleRight);
            TextAt(w, "Dot", "·", 438, 428, 10, 14, Hex("e83b3b"), TextAnchor.MiddleCenter);
            view.block = LinkText(w, "Block", "Engelle", 448, 428, 50, Hex("e83b3b"));
            return wrap.gameObject;
        }

        /// <summary>A left-to-right row at draft coordinates: children sit side by side at their own width.</summary>
        static RectTransform Row(Transform parent, string name, float x, float y, float w, float h, int spacing)
        {
            var rt = Abs(parent, name, x, y, w, h);
            Layout<HorizontalLayoutGroup>(rt, spacing, null, TextAnchor.MiddleLeft);
            return rt;
        }

        /// <summary>The purple level tag sized to its text (kit tag_level).</summary>
        static RectTransform LevelTag(Transform parent, out Text text)
        {
            var tag = Node("LevelTag", parent);
            Img(tag, "tag_level");
            Layout<HorizontalLayoutGroup>(tag, 0, new RectOffset(5, 5, 2, 2), TextAnchor.MiddleCenter);
            Size(tag, minH: 18, prefH: 18);
            text = Txt(Node("Text", tag), "Lv 1", 11, Color.white, TextAnchor.MiddleCenter);
            return tag;
        }

        // ================= Friends (drafts arkadaslar-list, arkadaslar-requests) =================

        /// <summary>
        /// THE tab of the game: every window with tabs uses this, so one change here changes them all.
        /// Selected: kit button_wood_normal with paper text; unselected: kit tab_off with ink text.
        /// </summary>
        static TabButton Tab(Transform parent, string name, string label, float x, float y, float w, float h, int size = 15, TextAnchor align = TextAnchor.MiddleCenter)
        {
            var rt = Abs(parent, name, x, y, w, h);
            var tab = rt.gameObject.AddComponent<TabButton>();
            tab.on = S("button_wood_normal");
            tab.off = S("tab_off");
            tab.onText = Paper;
            tab.offText = Ink;
            tab.image = Img(rt, "tab_off", Image.Type.Sliced, true);
            tab.button = rt.gameObject.AddComponent<Button>();
            tab.button.targetGraphic = tab.image;
            tab.button.transition = Selectable.Transition.None;
            var nav = tab.button.navigation;
            nav.mode = Navigation.Mode.None;
            tab.button.navigation = nav;
            tab.label = Txt(Stretch(Node("Label", rt), align == TextAnchor.MiddleLeft ? 12 : 4, 2, 4, 1), label, size, Ink, align, true);
            return tab;
        }

        static Button SmallButton(Transform parent, string name, string colour, string label, float x, float y, float w, float h, int size = 13)
        {
            var b = Btn(parent, name, colour, label, size);
            At((RectTransform)b.transform, TopLeft, new Vector2(x, -y), new Vector2(w, h));
            return b;
        }

        static GameObject BuildFriends()
        {
            // arkadaslar-list: window 516x510 at (302, 148); rows 476x46, 50 apart.
            var wrap = Stretch(Node("Friends", null));
            var view = wrap.gameObject.AddComponent<FriendsView>();
            view.window = DraftWindow(wrap, "Arkadaşlar", 302, 148, 516, 510);
            var w = view.window.transform;
            float[] tx = { 23, 148, 233 }, tw = { 115, 77, 75 };
            string[] tl = { "Arkadaşlar", "İstekler", "Engelli" };
            view.tabs = new TabButton[3];
            for (var i = 0; i < 3; i++) view.tabs[i] = Tab(w, "Tab" + i, tl[i], tx[i], 17, tw[i], 26, 14);
            var badge = At(Node("Badge", view.tabs[1].transform), TopRight, new Vector2(4, 8), new Vector2(16, 16));
            Img(badge, "button_red_normal");
            view.requestCount = Txt(Stretch(Node("Text", badge)), "0", 11, Color.white, TextAnchor.MiddleCenter, true);
            view.requestBadge = badge.gameObject;
            Img(Abs(w, "TabLine", 23, 43, 470, 4), "divider");
            view.search = Field(Abs(w, "Search", 23, 57, 358, 30), "Oyuncu adı yaz...", 14);
            view.search.characterLimit = 16;
            view.add = SmallButton(w, "Add", "green", "Ekle", 391, 57, 102, 30, 15);

            var scroll = Abs(w, "List", 21, 98, 476, 364);
            var sr = scroll.gameObject.AddComponent<ScrollRect>();
            sr.horizontal = false;
            sr.movementType = ScrollRect.MovementType.Clamped;
            sr.scrollSensitivity = 30;
            var viewport = Stretch(Node("Viewport", scroll));
            viewport.gameObject.AddComponent<RectMask2D>();
            viewport.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            var content = Node("Content", viewport);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = content.offsetMax = Vector2.zero;
            Layout<VerticalLayoutGroup>(content, 4).childForceExpandWidth = true;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.viewport = viewport;
            sr.content = content;
            view.list = content;

            view.sectionTemplate = Label(content, "Section", "Çevrimiçi · 0", 14, Faint);
            Size(view.sectionTemplate, minH: 20);
            view.sectionTemplate.gameObject.SetActive(false);

            var row = Node("RowTemplate", content);
            Size(row, minH: 46, prefH: 46);
            var fr = row.gameObject.AddComponent<FriendRow>();
            fr.back = Img(row, "card");
            Img(Stretch(Node("Outline", row)), "outline");
            fr.avatar = SlotAt(row, "Avatar", 8, 7, 32);
            fr.avatar.label.SetSize(10);
            var dot = At(Node("Dot", fr.avatar.transform), BottomRight, new Vector2(3, -3), new Vector2(10, 10), BottomRight);
            fr.dot = Img(dot, "checkbox_on", Image.Type.Simple);
            view.dotOnline = S("checkbox_on");
            view.dotOffline = S("slot_locked");
            fr.player = TextAt(row, "Name", "", 50, 14, 260, 16, Ink, TextAnchor.MiddleLeft, true);
            fr.sub = TextAt(row, "Sub", "", 50, 34, 260, 13, Faint);
            fr.sub.supportRichText = true;
            fr.go = SmallButton(row, "Go", "green", "Yanına git", 314, 10, 82, 26);
            fr.chat = SmallButton(row, "Chat", "square_wood", "✉", 405, 9, 28, 28, 13);
            fr.menu = SmallButton(row, "Menu", "square_wood", "≡", 439, 9, 28, 28, 14);
            fr.no = SmallButton(row, "No", "red", "Hayır", 330, 10, 63, 26);
            fr.yes = SmallButton(row, "Yes", "green", "Kabul", 401, 10, 63, 26);
            fr.cancel = SmallButton(row, "Cancel", "wood", "İptal", 401, 10, 63, 26);
            fr.unblock = SmallButton(row, "Unblock", "wood", "Engeli kaldır", 364, 10, 100, 26);
            view.rowTemplate = fr;
            row.gameObject.SetActive(false);
            view.rowOnline = S("card");
            view.rowOffline = null;

            view.empty = TextAt(w, "Empty", "", 23, 200, 470, 15, Faint, TextAnchor.MiddleCenter);
            TextAt(w, "PmLabel", "Sadece arkadaşlardan mesaj al", 25, 481, 360, 14, Ink);
            var toggle = Abs(w, "FriendsOnly", 469, 469, 24, 24);
            var off = Img(toggle, "checkbox_off", Image.Type.Simple, true);
            var on = Img(Stretch(Node("On", toggle)), "checkbox_on", Image.Type.Simple);
            view.friendsOnly = toggle.gameObject.AddComponent<Toggle>();
            view.friendsOnly.targetGraphic = off;
            view.friendsOnly.graphic = on;
            view.friendsOnly.transition = Selectable.Transition.None;
            return wrap.gameObject;
        }

        // ================= NPC windows (drafts npc-sat, npc-parcala, npc-craft, npc-birlestir, npc-depo) =================

        /// <summary>40 px slots, 46 apart, cols wide; rows visible, the rest scrolls.</summary>
        static SlotGrid GridAt(Transform parent, string name, float x, float y, int cols, int rows)
        {
            var scroll = Abs(parent, name, x, y, cols * 46 - 6, rows * 46 - 6);
            var sr = scroll.gameObject.AddComponent<ScrollRect>();
            sr.horizontal = false;
            sr.movementType = ScrollRect.MovementType.Clamped;
            sr.scrollSensitivity = 30;
            var viewport = Stretch(Node("Viewport", scroll));
            viewport.gameObject.AddComponent<RectMask2D>();
            viewport.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            var content = Node("Content", viewport);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = content.offsetMax = Vector2.zero;
            var grid = content.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(40, 40);
            grid.spacing = new Vector2(6, 6);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = cols;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            sr.viewport = viewport;
            sr.content = content;
            var template = Slot(content, "SlotTemplate");
            template.gameObject.SetActive(false);
            return new SlotGrid { content = content, template = template };
        }

        static TabButton[] NpcTabs(Transform w, string[] labels)
        {
            var tabs = new TabButton[labels.Length];
            for (var i = 0; i < labels.Length; i++) tabs[i] = Tab(w, "Tab" + i, labels[i], 29 + i * 132, 27, 127, 35, 15);
            return tabs;
        }

        static void Balances(Transform w, out Text coin, out Text dust, out Image dustIcon, bool withCoin = true)
        {
            coin = null;
            if (withCoin)
            {
                Icon(w, "CoinIcon", new Vector2(0, 1), new Vector2(766, -42), Gold, 14);
                coin = TextAt(w, "Coin", "0", 786, 42, 80, 16, Ink, TextAnchor.MiddleLeft, true);
            }
            var icon = At(Node("DustIcon", w), new Vector2(0, 1), new Vector2(866, -42), new Vector2(12, 12), new Vector2(0, 0.5f));
            dustIcon = Solid(icon, DiamondColour);
            dust = TextAt(w, "Dust", "0", 884, 42, 60, 16, Hex("4d9be6"), TextAnchor.MiddleLeft, true);
        }

        static GameObject BuildMerchant()
        {
            // npc-sat / npc-parcala: same frame as npc-gorev; bag at (29,110), basket card at (421,82).
            var wrap = Stretch(Node("Merchant", null));
            var view = wrap.gameObject.AddComponent<MerchantView>();
            view.window = DraftWindow(wrap, "Balıkçı Tüccar", 224, 106, 956, 594);
            var w = view.window.transform;
            view.tabs = NpcTabs(w, new[] { "Sat", "Parçala", "Dükkan" });
            Balances(w, out view.coin, out view.dust, out view.dustIcon);

            var sell = Stretch(Node("Sell", w));
            view.sell = sell.gameObject;
            TextAt(sell, "BagLabel", "Çanta", 29, 92, 60, 16, Ink, TextAnchor.MiddleLeft, true);
            view.bagHint = TextAt(sell, "BagHint", "tıkla: sepete ekle", 97, 92, 250, 14, Faint);
            view.bag = GridAt(sell, "Bag", 29, 110, 8, 5);
            TextAt(sell, "LockHint", "Kilitli eşya satılmaz, parçalanmaz.", 29, 355, 360, 14, Faint);
            var basket = Abs(sell, "Basket", 421, 82, 512, 489);
            Img(basket, "card");
            Img(Stretch(Node("Outline", basket)), "outline");
            view.basketTitle = TextAt(basket, "Title", "Sepet", 16, 22, 300, 16, Ink, TextAnchor.MiddleLeft, true);
            view.coinMark = null;
            view.lines = new BasketLine[11];
            for (var i = 0; i < view.lines.Length; i++)
            {
                var y = 52 + i * 28;
                var line = Abs(basket, "Line" + i, 10, y - 12, 492, 24);
                var l = new BasketLine { root = line.gameObject };
                line.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
                l.hover = line.gameObject.AddComponent<CardHover>();
                l.icon = SlotAt(line, "Icon", 6, 2, 20);
                l.icon.label.SetSize(6);
                l.name = TextAt(line, "Name", "", 37, 12, 340, 15, Ink);
                l.valueIcon = Solid(At(Node("ValueIcon", line), new Vector2(0, 1), new Vector2(430, -12), new Vector2(12, 12), new Vector2(0, 0.5f)), Gold);
                l.value = TextAt(line, "Value", "", 448, 12, 50, 15, Ink, TextAnchor.MiddleLeft, true);
                view.lines[i] = l;
            }
            view.more = TextAt(basket, "More", "", 16, 360, 300, 13, Faint);
            Img(Abs(basket, "Line", 14, 366, 484, 4), "divider");
            TextAt(basket, "TotalLabel", "Toplam", 16, 390, 120, 17, Ink);
            view.totalIcon = Solid(At(Node("TotalIcon", basket), new Vector2(0, 1), new Vector2(400, -388), new Vector2(14, 14), new Vector2(0, 0.5f)), Gold);
            view.totalValue = TextAt(basket, "Total", "0", 420, 388, 80, 17, Ink, TextAnchor.MiddleLeft, true);
            view.note = TextAt(basket, "Note", "", 16, 412, 480, 14, Faint);
            view.sellButton = SmallButton(basket, "Sell", "green", "Sat", 16, 437, 478, 36, 17);
            view.sellText = view.sellButton.GetComponentInChildren<Text>();
            view.salvageButton = SmallButton(basket, "Salvage", "red", "Parçala", 16, 437, 478, 36, 17);
            view.salvageText = view.salvageButton.GetComponentInChildren<Text>();

            var shop = Stretch(Node("Shop", w));
            view.shop = shop.gameObject;
            TextAt(shop, "RodLabel", "Olta", 29, 92, 100, 16, Ink, TextAnchor.MiddleLeft, true);
            view.rodText = TextAt(shop, "Rod", "", 29, 122, 380, 15, Ink);
            view.rodFill = Bar(Abs(shop, "RodBar", 29, 138, 220, 14), "bar_fill_green", out _);
            view.repair = SmallButton(shop, "Repair", "wood", "Tamir et", 29, 164, 200, 34, 15);
            view.repairText = view.repair.GetComponentInChildren<Text>();
            TextAt(shop, "RodNote", "Olta yıprandıkça tamir edilir; kırık olta sadece çöp çıkarır.", 29, 220, 380, 13, Faint).horizontalOverflow = HorizontalWrapMode.Wrap;
            var baitCard = Abs(shop, "Baits", 421, 82, 512, 489);
            Img(baitCard, "card");
            Img(Stretch(Node("Outline", baitCard)), "outline");
            TextAt(baitCard, "Title", "Özel yem", 16, 22, 300, 16, Ink, TextAnchor.MiddleLeft, true);
            TextAt(baitCard, "Hint", "Yem sadece oranları kaydırır, yeni eşya eklemez. Her atış 1 yem harcar.", 16, 44, 480, 13, Faint);
            view.baits = new BaitRow[4];
            for (var i = 0; i < 4; i++)
            {
                var y = 64 + i * 60;
                var row = Abs(baitCard, "Bait" + i, 10, y, 492, 52);
                var b = new BaitRow { root = row.gameObject };
                b.icon = SlotAt(row, "Icon", 6, 6, 40);
                b.name = TextAt(row, "Name", "", 56, 16, 200, 15, Ink, TextAnchor.MiddleLeft, true);
                b.info = TextAt(row, "Info", "", 56, 36, 200, 13, Faint);
                b.minus = SmallButton(row, "Minus", "wood", "-", 246, 13, 26, 26, 14);
                b.count = TextAt(row, "Count", "5", 274, 26, 30, 15, Ink, TextAnchor.MiddleCenter, true);
                b.plus = SmallButton(row, "Plus", "wood", "+", 306, 13, 26, 26, 14);
                b.buy = SmallButton(row, "Buy", "green", "Al", 338, 13, 76, 26, 13);
                b.buyText = b.buy.GetComponentInChildren<Text>();
                b.use = SmallButton(row, "Use", "wood", "Kullan", 418, 13, 72, 26, 13);
                b.useText = b.use.GetComponentInChildren<Text>();
                view.baits[i] = b;
            }
            return wrap.gameObject;
        }

        static GameObject BuildCrafter()
        {
            // npc-craft / npc-birlestir: same frame; recipe cards at (29,110) 247x42, 48 apart; detail card at (297,82).
            var wrap = Stretch(Node("Crafter", null));
            var view = wrap.gameObject.AddComponent<CrafterView>();
            view.window = DraftWindow(wrap, "Zanaatkar", 224, 106, 956, 594);
            var w = view.window.transform;
            view.tabs = NpcTabs(w, new[] { "Craft", "Birleştir" });
            view.cardOn = S("button_wood_normal");
            view.cardOff = S("card");
            Balances(w, out _, out view.dust, out _, false);

            var craft = Stretch(Node("Craft", w));
            view.craft = craft.gameObject;
            TextAt(craft, "RecipesLabel", "Recipe'lerin", 29, 92, 200, 16, Ink);
            view.recipes = new CrafterView.RecipeCard[8];
            for (var i = 0; i < view.recipes.Length; i++)
            {
                var rt = Abs(craft, "Recipe" + i, 29, 110 + i * 48, 247, 42);
                var c = new CrafterView.RecipeCard { root = rt.gameObject };
                c.back = Img(rt, "card", Image.Type.Sliced, true);
                c.button = rt.gameObject.AddComponent<Button>();
                c.button.targetGraphic = c.back;
                c.button.transition = Selectable.Transition.None;
                SlotAt(rt, "Icon", 8, 7, 28).label.SetSize(7);
                c.name = TextAt(rt, "Name", "", 44, 13, 195, 14, Ink, TextAnchor.MiddleLeft, true);
                c.grade = TextAt(rt, "Grade", "", 44, 30, 195, 13, Faint);
                view.recipes[i] = c;
            }
            view.noRecipe = TextAt(craft, "NoRecipe", "Çantanda recipe yok. Recipe balıktan \"şişedeki recipe\" olarak çıkar.", 29, 140, 250, 14, Faint);
            view.noRecipe.horizontalOverflow = HorizontalWrapMode.Wrap;
            ((RectTransform)view.noRecipe.transform).sizeDelta = new Vector2(250, 60);
            var detail = Abs(craft, "Detail", 297, 82, 636, 489);
            Img(detail, "card");
            Img(Stretch(Node("Outline", detail)), "outline");
            view.detail = detail.gameObject;
            view.recipeName = TextAt(detail, "Name", "", 16, 22, 600, 16, Ink);
            view.recipeSub = TextAt(detail, "Sub", "", 16, 42, 600, 14, Faint);
            view.needs = new CrafterView.Need[4];
            for (var i = 0; i < 4; i++)
            {
                var y = 66 + i * 44;
                var n = new CrafterView.Need { root = Abs(detail, "Need" + i, 16, y, 600, 42).gameObject };
                n.icon = SlotAt(n.root.transform, "Icon", 0, 2, 38);
                n.name = TextAt(n.root.transform, "Name", "", 50, 12, 300, 15, Ink);
                n.have = TextAt(n.root.transform, "Have", "", 50, 30, 300, 14, Hex("1e6f50"));
                view.needs[i] = n;
            }
            view.recipeDust = TextAt(detail, "Dust", "", 36, 168, 400, 15, Hex("4d9be6"));
            Solid(At(Node("DustIcon", detail), new Vector2(0, 1), new Vector2(16, -168), new Vector2(12, 12), new Vector2(0, 0.5f)), DiamondColour);
            TextAt(detail, "QualityLabel", "Kalite şansı", 16, 205, 120, 15, Ink);
            view.qualityFill = Bar(Abs(detail, "QualityBar", 124, 198, 180, 14), "bar_fill_yellow", out _);
            view.quality = TextAt(detail, "Quality", "", 314, 205, 200, 15, Hex("f79617"));
            view.note = TextAt(detail, "Note", "Çıkan eşyanın Float'ı şansa bağlı, en iyi malzeme garanti vermez.", 16, 233, 600, 14, Faint);
            view.missing = TextAt(detail, "Missing", "", 16, 420, 600, 14, Hex("e83b3b"));
            view.craftButton = SmallButton(detail, "Craft", "green", "Craft yap", 16, 437, 604, 36, 17);
            view.craftText = view.craftButton.GetComponentInChildren<Text>();

            var merge = Stretch(Node("Merge", w));
            view.merge = merge.gameObject;
            TextAt(merge, "Desc", "3'ü 1: aynı eşyadan 3 kopya + toz → daha temiz 1 kopya", 29, 92, 800, 15, Ink);
            TextAt(merge, "Desc2", "Tier değişmez, yeni Float çıkar, girdilerin en kötüsünden kötü olmaz. Recipe gerekmez.", 29, 111, 800, 14, Faint);
            view.inputs = new SlotView[3];
            view.inputNames = new Text[3];
            view.inputFloats = new Text[3];
            for (var i = 0; i < 3; i++)
            {
                var x = 109 + i * 108;
                view.inputs[i] = SlotAt(merge, "Input" + i, x, 150);
                view.inputNames[i] = TextAt(merge, "InputName" + i, "", x - 30, 206, 100, 14, Ink, TextAnchor.MiddleCenter);
                view.inputFloats[i] = TextAt(merge, "InputFloat" + i, "", x - 30, 226, 100, 13, Faint, TextAnchor.MiddleCenter);
                if (i < 2) TextAt(merge, "Plus" + i, "+", x + 56, 170, 20, 16, Ink, TextAnchor.MiddleCenter);
            }
            TextAt(merge, "Arrow", "→", 405, 170, 30, 16, Ink, TextAnchor.MiddleCenter);
            view.result = SlotAt(merge, "Result", 459, 138, 52);
            view.result.frame.pixelsPerUnitMultiplier = 1;
            view.resultName = TextAt(merge, "ResultName", "", 425, 216, 120, 14, Faint, TextAnchor.MiddleCenter);
            Solid(At(Node("DustIcon", merge), new Vector2(0, 1), new Vector2(109, -270), new Vector2(12, 12), new Vector2(0, 0.5f)), DiamondColour);
            view.mergeDust = TextAt(merge, "Dust", "", 129, 270, 600, 15, Hex("4d9be6"));
            view.mergeDust.supportRichText = true;
            TextAt(merge, "QualityLabel", "Girdi kalitesi", 109, 306, 120, 15, Ink);
            view.mergeFill = Bar(Abs(merge, "QualityBar", 236, 299, 180, 14), "bar_fill_yellow", out _);
            view.mergeQuality = TextAt(merge, "Quality", "", 426, 306, 200, 15, Hex("f79617"));
            view.mergeButton = SmallButton(merge, "Merge", "green", "Birleştir", 733, 264, 198, 40, 17);
            view.mergeNote = TextAt(merge, "Note", "Her birleştirme 2 eşyayı oyundan siler.", 560, 327, 371, 14, Faint, TextAnchor.MiddleRight);
            TextAt(merge, "BagLabel", "Çanta (aynı eşyadan kopyalar seçilir)", 29, 346, 500, 15, Ink);
            view.bag = GridAt(merge, "Bag", 29, 362, 10, 2);
            view.barGood = S("bar_fill_green");
            view.barMid = S("bar_fill_yellow");
            return wrap.gameObject;
        }

        static GameObject BuildBank()
        {
            // npc-depo: window 1031x564 at (186, 132); stash 10 wide at (26,60), bag 8 wide at (526,60).
            var wrap = Stretch(Node("Bank", null));
            var view = wrap.gameObject.AddComponent<BankView>();
            view.window = DraftWindow(wrap, "Banka", 186, 132, 1031, 564);
            var w = view.window.transform;
            view.stashTitle = TextAt(w, "StashLabel", "Depo", 26, 40, 60, 16, Ink, TextAnchor.MiddleLeft, true);
            view.stashCount = TextAt(w, "StashCount", "", 88, 40, 200, 14, Faint);
            view.stash = GridAt(w, "Stash", 26, 60, 10, 10);
            view.footer = TextAt(w, "Footer", "Depo sadece bankada açılır. Tıkla: çantaya al.", 26, 537, 480, 14, Faint);
            view.bagTitle = TextAt(w, "BagLabel", "Çanta", 526, 40, 60, 16, Ink, TextAnchor.MiddleLeft, true);
            TextAt(w, "BagHint", "tıkla: depoya koy", 596, 40, 300, 14, Faint);
            view.bag = GridAt(w, "Bag", 526, 60, 8, 5);
            view.hint = TextAt(w, "Hint", "Defter yuvasındaki eşya depoya konmaz.\nDepodaki eşya satılmaz, parçalanmaz;\nönce çantaya al.", 526, 320, 460, 14, Faint);
            ((RectTransform)view.hint.transform).sizeDelta = new Vector2(460, 60);
            var expand = Abs(w, "Expand", 526, 485, 485, 60);
            Img(expand, "card");
            Img(Stretch(Node("Outline", expand)), "outline");
            view.expand = expand.gameObject;
            TextAt(expand, "Title", "Depoyu genişlet", 12, 16, 260, 16, Ink);
            view.expandSlots = TextAt(expand, "Slots", "", 12, 40, 100, 14, Hex("1e6f50"));
            Icon(expand, "CoinIcon", new Vector2(0, 1), new Vector2(122, -40), Gold, 12);
            view.expandPrice = TextAt(expand, "Price", "", 140, 40, 120, 14, Ink, TextAnchor.MiddleLeft, true);
            view.expandButton = SmallButton(expand, "Expand", "green", "Genişlet", 352, 11, 118, 38, 15);
            view.expandText = view.expandButton.GetComponentInChildren<Text>();
            return wrap.gameObject;
        }

        // ================= Fishing moments (drafts balik-*) =================

        static GameObject BuildFishing()
        {
            // Pieces are placed by World/FishingHud.cs around the player; sizes are from the drafts.
            var root = Stretch(Node("Fishing", null));
            var view = root.gameObject.AddComponent<FishingView>();

            // balik-at: 214x66 dark box, band labels over thirds, two framed sage boxes (Kıyı + Orta with a
            // faint line between them, Derin apart), yellow fill, a white marker standing out above and below.
            var charge = At(Node("Charge", root), BottomLeft, Vector2.zero, new Vector2(214, 66), new Vector2(0.5f, 0));
            Img(charge, "box_dark");
            TextAt(charge, "Shore", "Kıyı", 13, 18, 60, 15, Paper, TextAnchor.MiddleCenter, true);
            TextAt(charge, "Mid", "Orta", 78, 18, 60, 15, Paper, TextAnchor.MiddleCenter, true);
            TextAt(charge, "Deep", "Derin", 142, 18, 60, 15, Paper, TextAnchor.MiddleCenter, true);
            RectTransform MeterBox(string name, float x, float w)
            {
                var box = Abs(charge, name, x, 32, w, 16);
                Img(box, "meter_back", Image.Type.Sliced);
                var inner = Stretch(Node("Inner", box), 2, 2, 2, 2);
                var fill = Node("Fill", inner);
                fill.anchorMin = Vector2.zero;
                fill.anchorMax = new Vector2(0.5f, 1f);
                fill.offsetMin = fill.offsetMax = Vector2.zero;
                Img(fill, "bar_fill_yellow", Image.Type.Sliced);
                return fill;
            }
            view.chargeFill = MeterBox("ShoreMid", 12, 126);
            var line = Abs(charge, "Line", 74, 34, 2, 12);
            Solid(line, new Color(0.27f, 0.16f, 0.25f, 0.35f));
            view.chargeFillDeep = MeterBox("Deep", 140, 62);
            view.chargeTrack = Abs(charge, "Track", 14, 28, 186, 24);
            var marker = Node("Marker", view.chargeTrack);
            marker.anchorMin = marker.anchorMax = new Vector2(0.55f, 0.5f);
            marker.sizeDelta = new Vector2(4, 24);
            Solid(marker, Color.white);
            view.chargeMarker = marker;
            view.chargeSub = TextAt(charge, "Sub", "atış mesafesi", 0, 57, 214, 13, Hex("9babb2"), TextAnchor.MiddleCenter, true);
            view.charge = charge;

            // balik-vurus: "!" over the head and "Şimdi tıkla!" in a bubble beside it.
            var bite = At(Node("Bite", root), BottomLeft, Vector2.zero, new Vector2(220, 40), new Vector2(0.5f, 0));
            Txt(At(Node("Mark", bite), new Vector2(0.5f, 0.5f), new Vector2(-50, 0), new Vector2(30, 40), Center), "!", 30, Gold, TextAnchor.MiddleCenter, true, true);
            var bubble = At(Node("Bubble", bite), new Vector2(0.5f, 0.5f), new Vector2(40, 0), new Vector2(120, 26), Center);
            Img(bubble, "box_dark");
            Txt(Stretch(Node("Text", bubble)), "Şimdi tıkla!", 14, Gold, TextAnchor.MiddleCenter, true);
            view.bite = bite;

            // balik-cekme: framed column 120x262: water with the green bar and the fish, progress on the right.
            var reel = At(Node("Reel", root), BottomLeft, Vector2.zero, new Vector2(120, 262), new Vector2(0.5f, 0));
            Img(reel, "window", Image.Type.Tiled, true);
            var water = Abs(reel, "Water", 18, 18, 56, 226);
            Solid(water, Hex("2e222f"));
            Img(Stretch(Node("Deep", water), 2, 2, 2, 2), "box_dark");
            view.water = water;
            var barRt = Node("Bar", water);
            barRt.anchorMin = new Vector2(0, 0);
            barRt.anchorMax = new Vector2(1, 0);
            barRt.pivot = new Vector2(0.5f, 0);
            barRt.sizeDelta = new Vector2(-4, 60);
            Img(barRt, "button_green_normal");
            view.bar = barRt;
            var fish = Node("Fish", water);
            fish.anchorMin = fish.anchorMax = new Vector2(0.5f, 0);
            fish.sizeDelta = new Vector2(40, 18);
            Img(fish, "button_flat_normal");
            Txt(Stretch(Node("Text", fish)), "balık", 9, Paper, TextAnchor.MiddleCenter, true);
            view.fish = fish;
            var prog = Abs(reel, "Progress", 80, 18, 22, 226);
            Img(prog, "bar_back");
            var pf = Node("Fill", prog);
            pf.anchorMin = Vector2.zero;
            pf.anchorMax = new Vector2(1, 0.3f);
            pf.offsetMin = pf.offsetMax = Vector2.zero;
            Img(pf, "bar_fill_yellow");
            view.progressFill = pf;
            view.reel = reel;

            // Hint line under the meter / reel ("basılı tut, bırak", "Space / fare basılı tut").
            var hint = At(Node("Hint", root), BottomLeft, Vector2.zero, new Vector2(420, 22), new Vector2(0.5f, 1));
            view.hintText = Txt(Stretch(Node("Text", hint)), "", 14, Color.white, TextAnchor.MiddleCenter, true, true);
            view.hint = hint;
            foreach (var go in new[] { charge, bite, reel, hint }) go.gameObject.SetActive(false);
            return root.gameObject;
        }

        static GameObject BuildCatch()
        {
            var wrap = Stretch(Node("Catch", null));
            var view = wrap.gameObject.AddComponent<CatchView>();

            // balik-kesif: 385x140 at (510, 120).
            var holder = Stretch(Node("Discover", wrap));
            view.discover = DraftWindow(holder, "Yeni keşif!", 510, 120, 385, 140);
            var d = view.discover.transform;
            view.discover.close.gameObject.SetActive(false);
            view.discoverSlot = SlotAt(d, "Slot", 27, 37, 72);
            view.discoverSlot.frame.pixelsPerUnitMultiplier = 1;
            view.discoverSlot.label.SetSize(13);
            view.discoverName = TextAt(d, "Name", "", 115, 46, 260, 16, Ink, TextAnchor.MiddleLeft, true);
            view.discoverTier = TextAt(d, "Tier", "", 115, 69, 260, 14, Hex("a884f3"));
            view.discoverFloat = TextAt(d, "Float", "", 115, 89, 260, 14, Hex("1e6f50"));
            view.discoverPage = TextAt(d, "Page", "", 115, 111, 260, 13, Faint);
            view.discoverFill = Bar(Abs(d, "PageBar", 115, 121, 100, 8), "bar_fill_green", out _);
            view.discoverNote = TextAt(d, "Note", "Deftere kondu", 235, 125, 140, 13, Faint);

            // balik-temiz: 390x200 at (505, 105).
            var holder2 = Stretch(Node("Swap", wrap));
            view.swap = DraftWindow(holder2, "Daha temiz kopya!", 505, 105, 390, 200);
            var w = view.swap.transform;
            view.swap.close.gameObject.SetActive(false);
            TextAt(w, "OldLabel", "Defterde", 68, 34, 80, 14, Ink, TextAnchor.MiddleCenter);
            view.oldSlot = SlotAt(w, "Old", 68, 47, 72);
            view.oldSlot.frame.pixelsPerUnitMultiplier = 1;
            view.oldSlot.label.SetSize(13);
            view.oldFloat = TextAt(w, "OldFloat", "", 58, 132, 92, 15, Faint, TextAnchor.MiddleCenter);
            view.oldCondition = TextAt(w, "OldCond", "", 58, 149, 92, 13, Faint, TextAnchor.MiddleCenter);
            TextAt(w, "Arrow", ">", 180, 83, 30, 20, Ink, TextAnchor.MiddleCenter, true);
            TextAt(w, "NewLabel", "Yeni", 248, 34, 80, 14, Ink, TextAnchor.MiddleCenter);
            view.newSlot = SlotAt(w, "New", 248, 47, 72);
            view.newSlot.frame.pixelsPerUnitMultiplier = 1;
            view.newSlot.label.SetSize(13);
            view.newFloat = TextAt(w, "NewFloat", "", 238, 132, 92, 15, Hex("1e6f50"), TextAnchor.MiddleCenter);
            view.newCondition = TextAt(w, "NewCond", "", 238, 149, 92, 13, Hex("1e6f50"), TextAnchor.MiddleCenter);
            view.swapYes = SmallButton(w, "Yes", "green", "Değiştir", 35, 163, 158, 30, 15);
            view.swapNo = SmallButton(w, "No", "wood", "Çantada kalsın", 205, 163, 158, 30, 15);
            var cap = Abs(w, "Caption", 0, 206, 390, 20);
            Img(cap, "box_dark");
            view.swapCaption = Txt(Stretch(Node("Text", cap)), "", 12, Paper, TextAnchor.MiddleCenter);
            return wrap.gameObject;
        }

        // ================= Notifications (drafts bildirim-yigin, bildirim-ust) =================

        static GameObject BuildNotices()
        {
            var root = Stretch(Node("Notices", null));
            var view = root.gameObject.AddComponent<NoticesView>();

            // Stack: 348x50 boxes from (1042, 74), 60 apart; "+N bildirim daha" under them.
            view.boxes = new NoticesView.Box[4];
            for (var i = 0; i < 4; i++)
            {
                var rt = At(Node("Box" + i, root), TopRight, new Vector2(-18, -(74 + i * 60)), new Vector2(348, 50));
                var b = new NoticesView.Box { root = rt };
                Img(rt, "box_dark", Image.Type.Sliced, true);
                b.hover = rt.gameObject.AddComponent<CardHover>();
                b.icon = Solid(Abs(rt, "Icon", 5, 5, 36, 36), Hex("e83b3b"));
                b.title = TextAt(rt, "Title", "", 52, 14, 290, 14, Paper, TextAnchor.MiddleLeft, true);
                b.sub = TextAt(rt, "Sub", "", 52, 33, 290, 13, Paper);
                var timer = Abs(rt, "Timer", 4, 45, 340, 3);
                timer.pivot = new Vector2(0, 1);
                b.timer = Solid(timer, Hex("f9c22b"));
                b.action = SmallButton(rt, "Action", "green", "Kabul", 250, 10, 88, 26, 13);
                b.actionText = b.action.GetComponentInChildren<Text>();
                b.action.gameObject.SetActive(false);
                rt.gameObject.SetActive(false);
                view.boxes[i] = b;
            }
            var more = At(Node("More", root), TopRight, new Vector2(-18, -(74 + 4 * 60)), new Vector2(150, 24));
            Img(more, "box_dark");
            view.moreText = Txt(Stretch(Node("Text", more)), "", 13, Paper, TextAnchor.MiddleCenter, true);
            view.more = more.gameObject;
            more.gameObject.SetActive(false);

            // Rare catch: 497x40 at the top centre with a red edge.
            var ann = At(Node("Announce", root), Top, new Vector2(0, -18), new Vector2(497, 40));
            Img(ann, "box_dark");
            Solid(Abs(ann, "Edge", 0, 0, 4, 40), Hex("e83b3b"));
            Solid(Abs(ann, "Icon", 14, 8, 24, 24), Hex("f79617"));
            view.announceTitle = TextAt(ann, "Title", "", 48, 13, 440, 14, Hex("e83b3b"), TextAnchor.MiddleLeft, true);
            view.announceTitle.supportRichText = true;
            view.announceSub = TextAt(ann, "Sub", "", 48, 30, 440, 12, Paper);
            view.announce = ann.gameObject;
            ann.gameObject.SetActive(false);

            // Level up: 505x187 at (450, 118), three unlock cards.
            var holder = Stretch(Node("LevelUp", root));
            view.levelUp = DraftWindow(holder, "", 450, 118, 505, 187);
            view.levelUp.blocksWorld = false; // closes by itself, the game does not stop
            Object.DestroyImmediate(view.levelUp.plate.gameObject);
            Object.DestroyImmediate(view.levelUp.close.gameObject);
            var w = view.levelUp.transform;
            TextAt(w, "Head", "SEVİYE ATLADIN", 0, 24, 505, 14, Faint, TextAnchor.MiddleCenter, true);
            view.level = TextAt(w, "Level", "Lv 1", 0, 56, 505, 34, Ink, TextAnchor.MiddleCenter, true);
            view.unlocks = new GameObject[3];
            view.unlockTitles = new Text[3];
            view.unlockSubs = new Text[3];
            for (var i = 0; i < 3; i++)
            {
                var c = Abs(w, "Unlock" + i, 20 + i * 158, 126, 150, 42);
                Img(c, "card");
                Img(Stretch(Node("Outline", c)), "outline");
                Solid(Abs(c, "Icon", 10, 13, 14, 14), Gold);
                view.unlockTitles[i] = TextAt(c, "Title", "", 32, 13, 112, 13, Ink, TextAnchor.MiddleLeft, true);
                view.unlockSubs[i] = TextAt(c, "Sub", "", 32, 29, 112, 12, Faint);
                view.unlocks[i] = c.gameObject;
            }
            view.levelUp.Open = false;
            return root.gameObject;
        }

        // ================= Trade offer box (draft oyuncu-teklif) =================

        static GameObject BuildInvite()
        {
            var root = Stretch(Node("TradeInvite", null));
            var view = root.gameObject.AddComponent<InviteView>();
            // 390x92 at (508, 78), the caption under it.
            var box = Abs(root, "Box", 508, 78, 390, 92);
            Img(box, "box_dark", Image.Type.Sliced, true);
            view.root = box.gameObject;
            view.title = TextAt(box, "Title", "", 12, 22, 370, 16, Paper, TextAnchor.MiddleLeft, true);
            view.sub = TextAt(box, "Sub", "", 12, 42, 370, 13, Paper);
            var back = Abs(box, "Timer", 12, 60, 140, 10);
            view.timer = Bar(back, "bar_fill_yellow", out _);
            view.accept = SmallButton(box, "Accept", "green", "Kabul", 170, 50, 105, 30, 15);
            view.decline = SmallButton(box, "Decline", "red", "Reddet", 280, 50, 105, 30, 15);
            view.caption = Txt(At(Node("Caption", box), TopLeft, new Vector2(4, -98), new Vector2(380, 20)), "", 13, Color.white, TextAnchor.MiddleLeft, true, true);
            box.gameObject.SetActive(false);
            return root.gameObject;
        }

        // ================= Emote window (draft emote-menu) =================

        static SlotView EmoteSlot(Transform w, string name, float x, float y)
        {
            var s = SlotAt(w, name, x, y, 48);
            s.label.SetSize(11);
            return s;
        }

        static GameObject BuildEmote()
        {
            // emote-menu: window 538x415 at (842, 390); 48 px slots, 54 apart from x 30.
            var wrap = Stretch(Node("Emote", null));
            var view = wrap.gameObject.AddComponent<EmoteView>();
            view.window = DraftWindow(wrap, "Emote", 842, 390, 538, 415);
            var w = view.window.transform;
            var card = Abs(w, "Current", 18, 25, 502, 50);
            Img(card, "card");
            Img(Stretch(Node("Outline", card)), "outline");
            view.current = SlotAt(card, "Icon", 8, 6, 38);
            view.current.label.SetSize(10);
            view.currentText = TextAt(card, "Text", "", 58, 25, 340, 14, Ink);
            view.currentText.supportRichText = true;
            ((RectTransform)view.currentText.transform).sizeDelta = new Vector2(340, 40);
            view.remove = SmallButton(card, "Remove", "wood", "Kaldır", 395, 10, 98, 30, 15);
            TextAt(w, "StatusLabel", "Durum emote'ları", 30, 95, 170, 16, Ink);
            TextAt(w, "StatusHint", "tıkla: üstüne tak", 203, 95, 200, 13, Faint);
            Img(Abs(w, "StatusLine", 30, 106, 478, 4), "divider");
            view.status = new SlotView[16];
            for (var i = 0; i < 16; i++) view.status[i] = EmoteSlot(w, "Status" + i, 30 + i % 8 * 54, 118 + i / 8 * 58);
            TextAt(w, "GestureLabel", "Hareketler", 30, 252, 170, 16, Ink);
            TextAt(w, "GestureHint", "tıkla: yap (1-6 tuşları)", 140, 252, 300, 13, Faint);
            Img(Abs(w, "GestureLine", 30, 263, 478, 4), "divider");
            view.gestures = new SlotView[8];
            for (var i = 0; i < 8; i++) view.gestures[i] = EmoteSlot(w, "Gesture" + i, 30 + i * 54, 275);
            var foot = TextAt(w, "Footer", "Bir tane takılı kalır. Sunucudaki herkes görür.\nYürürken de durur; Kaldır'a basana kadar kalır.", 30, 366, 480, 13, Hex("1e6f50"));
            ((RectTransform)foot.transform).sizeDelta = new Vector2(480, 40);
            return wrap.gameObject;
        }

        // ================= Way into the game (drafts _akis-1..7) =================

        static GameObject BuildLogin()
        {
            var root = Stretch(Node("Login", null));
            var view = root.gameObject.AddComponent<LoginView>();
            Img(Stretch(Node("Shade", root)), "box_dark", Image.Type.Sliced, true);

            // _akis-1: the name plate 518x88 at (444, 140); Oyna and Ayarlar 220x44 at (594, 400 / 460).
            var plate = Abs(root, "TitlePlate", 444, 140, 518, 88);
            Img(plate, "button_wood_normal");
            Txt(Stretch(Node("Text", plate), 0, 4, 0, 0), "CollectionGame", 40, Gold, TextAnchor.MiddleCenter, true, true);
            view.titlePlate = plate.gameObject;
            var title = Stretch(Node("Title", root));
            view.title = title.gameObject;
            view.play = SmallButton(title, "Play", "green", "Oyna", 594, 400, 220, 44, 18);
            view.settings = SmallButton(title, "Settings", "wood", "Ayarlar", 594, 460, 220, 44, 18);
            view.version = TextAt(root, "Version", "", 16, 876, 300, 13, Paper, TextAnchor.MiddleLeft, false);
            view.credits = TextAt(root, "Credits", "Krediler · LPC Revised", 1092, 876, 300, 13, Paper, TextAnchor.MiddleRight, false);

            // Server address (development builds; the web build uses the page's host).
            var hostHolder = Stretch(Node("Host", root));
            view.host = DraftWindow(hostHolder, "Ayarlar", 494, 530, 420, 150);
            var h = view.host.transform;
            TextAt(h, "Label", "Sunucu adresi", 26, 40, 300, 15, Ink);
            view.hostField = Field(Abs(h, "Field", 26, 56, 368, 32), "127.0.0.1", 15);
            view.hostField.characterLimit = 64;
            view.hostSave = SmallButton(h, "Save", "green", "Kaydet", 274, 100, 120, 32, 15);
            view.host.Open = false;

            // _akis-2: "Oyuna gir" 516x424 at (444, 220).
            var guestHolder = Stretch(Node("Guest", root));
            view.guest = DraftWindow(guestHolder, "Oyuna gir", 444, 220, 516, 424);
            var g = view.guest.transform;
            view.guestPlay = SmallButton(g, "GuestPlay", "green", "Misafir olarak oyna", 56, 40, 404, 40, 17);
            var guestNote = TextAt(g, "GuestNote", "Kayıt yok, hemen başla. Sonra Ayarlar > Hesabını koru\nile bir hesap bağlarsın.", 30, 110, 456, 14, Faint, TextAnchor.MiddleCenter);
            ((RectTransform)guestNote.transform).sizeDelta = new Vector2(456, 40);
            Img(Abs(g, "LineL", 60, 146, 140, 4), "divider");
            TextAt(g, "Or", "veya şununla gir", 200, 148, 116, 13, Faint, TextAnchor.MiddleCenter);
            Img(Abs(g, "LineR", 316, 146, 140, 4), "divider");
            string[] social = { "G", "f", "D" };
            view.social = new Button[3];
            for (var i = 0; i < 3; i++)
            {
                view.social[i] = SmallButton(g, "Social" + i, "square_wood", social[i], 128 + i * 96, 170, 64, 64, 26);
                view.social[i].interactable = false;
            }
            TextAt(g, "SocialNote", "Google · Facebook · Discord (yakında)", 30, 252, 456, 13, Faint, TextAnchor.MiddleCenter);
            TextAt(g, "Private", "Gizli sekmede misafir hesabın kapanınca kaybolur.", 30, 312, 456, 14, Hex("e83b3b"), TextAnchor.MiddleCenter);
            var steam = TextAt(g, "Steam", "Steam'deki hesabınla da bu yollardan birini\nbağlayıp buradan girebilirsin.", 30, 360, 456, 13, Faint, TextAnchor.MiddleCenter);
            ((RectTransform)steam.transform).sizeDelta = new Vector2(456, 40);
            view.guest.Open = false;

            // _akis-5: the character, 756x474 at (324, 140). Only the name is kept by the server today.
            var charHolder = Stretch(Node("Character", root));
            view.character = DraftWindow(charHolder, "Karakterini oluştur", 324, 140, 756, 474);
            var c = view.character.transform;
            var preview = Abs(c, "Preview", 28, 28, 276, 356);
            Img(preview, "card");
            Img(Stretch(Node("Outline", preview)), "outline");
            Txt(Stretch(Node("Text", preview), 10, 10, 10, 10), "Karakter görünümü\nsonra seçilecek", 15, Faint, TextAnchor.MiddleCenter);
            TextAt(c, "NameLabel", "Ad", 346, 32, 80, 16, Ink);
            view.nameField = Field(Abs(c, "Name", 420, 16, 300, 32), "Adın", 16);
            view.nameField.characterLimit = 16;
            TextAt(c, "NameRule", "3-16: harf, rakam, _", 420, 64, 300, 13, Faint);
            var look = TextAt(c, "Look", "Gövde, ten, saç ve kıyafet seçimi karakter görünümü\nsunucuya eklenince gelecek.", 346, 140, 380, 14, Faint);
            ((RectTransform)look.transform).sizeDelta = new Vector2(380, 40);
            TextAt(c, "Fixed", "Ad sonra değişmez, iyi düşün.", 346, 410, 380, 13, Faint);
            view.back = SmallButton(c, "Back", "wood", "Geri", 346, 428, 180, 36, 16);
            view.next = SmallButton(c, "Next", "green", "Devam", 536, 428, 190, 36, 16);
            view.character.Open = false;

            // _akis-6: server list, 716x476 at (344, 128); rows 684x60, 68 apart.
            var srvHolder = Stretch(Node("Servers", root));
            view.servers = DraftWindow(srvHolder, "Sunucu seç", 344, 128, 716, 476);
            var sv = view.servers.transform;
            view.greeting = TextAt(sv, "Greeting", "", 22, 26, 660, 14, Ink);
            view.rowFriends = S("panel_locked");
            view.rowPlain = S("card");
            view.fillGreen = S("bar_fill_green");
            view.fillYellow = S("bar_fill_yellow");
            view.fillRed = S("bar_fill_red");
            view.flagTr = S("flag_tr");
            view.flagEn = S("flag_en");
            view.rows = new LoginView.ServerRow[6];
            for (var i = 0; i < 6; i++)
            {
                var rt = Abs(sv, "Row" + i, 16, 44 + i * 68, 684, 60);
                var r = new LoginView.ServerRow { root = rt.gameObject };
                r.back = Img(rt, "card");
                Img(Stretch(Node("Outline", rt)), "outline");
                r.flag = Img(Abs(rt, "Flag", 12, 18, 32, 22), "flag_tr", Image.Type.Simple);
                r.name = TextAt(rt, "Name", "", 54, 20, 220, 17, Ink, TextAnchor.MiddleLeft, true);
                r.friends = TextAt(rt, "Friends", "", 54, 41, 220, 13, Hex("1e6f50"));
                r.fill = Bar(Abs(rt, "Bar", 290, 14, 200, 14), "bar_fill_green", out r.fillImage);
                r.count = TextAt(rt, "Count", "", 290, 41, 100, 13, Ink);
                r.warn = TextAt(rt, "Warn", "", 390, 41, 140, 13, Hex("e83b3b"));
                r.go = SmallButton(rt, "Go", "green", "Gir", 548, 12, 124, 36, 16);
                view.rows[i] = r;
            }
            view.refresh = LinkText(sv, "Refresh", "Yenile", 22, 452, 80, Hex("4d65b4"));
            view.logout = LinkText(sv, "Logout", "Çıkış", 620, 452, 80, Hex("e83b3b"), TextAnchor.MiddleRight);
            view.servers.Open = false;

            // _akis-7: loading.
            var loading = Stretch(Node("Loading", root));
            view.loading = loading.gameObject;
            view.loadingText = TextAt(loading, "Text", "", 304, 392, 800, 20, Color.white, TextAnchor.MiddleCenter, true);
            ((GameText)view.loadingText).ForceShadow = true;
            view.loadingFill = Bar(Abs(loading, "Bar", 544, 490, 320, 14), "bar_fill_green", out _);
            var tipBox = Abs(loading, "Tip", 404, 782, 600, 40);
            Img(tipBox, "box_dark");
            view.tip = Txt(Stretch(Node("Text", tipBox), 12, 0, 12, 0), "", 13, Paper, TextAnchor.MiddleCenter);
            loading.gameObject.SetActive(false);

            view.error = TextAt(root, "Error", "", 304, 676, 800, 16, Hex("e83b3b"), TextAnchor.MiddleCenter, true);
            ((GameText)view.error).ForceShadow = true;
            view.error.horizontalOverflow = HorizontalWrapMode.Wrap;
            return root.gameObject;
        }

        // ================= Whisper window =================

        static GameObject BuildWhisper()
        {
            var wrap = Stretch(Node("Whisper", null));
            var view = wrap.gameObject.AddComponent<WhisperView>();
            var size = new Vector2(300, 210);
            view.window = Window(wrap, "Window", "Fısıltı", size);
            view.window.blocksWorld = false; // a whisper stays open while playing
            At((RectTransform)view.window.transform, BottomRight, new Vector2(-420, 190), size, BottomRight);
            view.plateImage = view.window.plate.GetComponent<Image>();
            // Grip square at the top-left corner: drag it to put the window anywhere (31.10.2026, Onur).
            var grip = At(Node("Handle", view.window.transform), TopLeft, new Vector2(8, -8), new Vector2(20, 18));
            Img(grip, "button_square_wood_normal", Image.Type.Sliced, true);
            for (var gy = 0; gy < 2; gy++)
                for (var gx = 0; gx < 3; gx++)
                    Solid(At(Node("Dot", grip), TopLeft, new Vector2(5 + gx * 4, -(5 + gy * 4)), new Vector2(2, 2)), Paper);
            view.window.handle = grip;
            view.minimize = Btn(view.window.transform, "Minimize", "flat", "_", 12);
            At((RectTransform)view.minimize.transform, TopRight, new Vector2(-54, -8), new Vector2(20, 18));
            view.menuButton = Btn(view.window.transform, "Menu", "flat", "≡", 12);
            At((RectTransform)view.menuButton.transform, TopRight, new Vector2(-32, -8), new Vector2(20, 18));

            var body = view.window.body;
            Layout<VerticalLayoutGroup>(body, 4).childForceExpandWidth = true;
            var menu = Node("MenuRow", body);
            Layout<HorizontalLayoutGroup>(menu, 4).childForceExpandWidth = true;
            Size(menu, minH: 22);
            view.block = Btn(menu, "Block", "red", "Engelle", 12);
            view.report = Btn(menu, "Report", "wood", "Raporla", 12);
            Size(view.block, minH: 22, flexW: 1);
            Size(view.report, minH: 22, flexW: 1);
            view.menuRow = menu;
            menu.gameObject.SetActive(false);

            var reasons = Node("Reasons", body);
            var grid = reasons.gameObject.AddComponent<GridLayoutGroup>();
            grid.cellSize = new Vector2(84, 20);
            grid.spacing = new Vector2(3, 3);
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            grid.constraintCount = 3;
            Size(reasons, minH: 43);
            string[] labels = { "Spam", "Hakaret", "Dolandırıcılık", "Kişisel bilgi", "Hile", "Diğer" };
            view.reasons = new Button[labels.Length];
            for (var i = 0; i < labels.Length; i++) view.reasons[i] = Btn(reasons, "Reason" + i, "flat", labels[i], 11);
            view.reasonRow = reasons;
            reasons.gameObject.SetActive(false);

            var scroll = Node("Scroll", body);
            Size(scroll, flexH: 1, flexW: 1);
            var sr = scroll.gameObject.AddComponent<ScrollRect>();
            sr.horizontal = false;
            sr.movementType = ScrollRect.MovementType.Clamped;
            sr.scrollSensitivity = 24;
            var viewport = Stretch(Node("Viewport", scroll));
            viewport.gameObject.AddComponent<RectMask2D>();
            viewport.gameObject.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            var content = Node("Log", viewport);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.offsetMin = content.offsetMax = Vector2.zero;
            var logLayout = Layout<VerticalLayoutGroup>(content, 6, new RectOffset(2, 4, 2, 2));
            logLayout.childForceExpandWidth = true;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            view.log = content;
            // One message: nick on top, text under it (31.10.2026, Onur); WhisperLine puts mine on the right.
            var msg = Node("LineTemplate", content);
            Layout<VerticalLayoutGroup>(msg, 2).childForceExpandWidth = true;
            var wl = msg.gameObject.AddComponent<WhisperLine>();
            wl.nick = Txt(Node("Nick", msg), "", 10, Faint, TextAnchor.UpperLeft);
            wl.text = Txt(Node("Text", msg), "", 12, Ink, TextAnchor.UpperLeft);
            wl.text.horizontalOverflow = HorizontalWrapMode.Wrap;
            wl.text.supportRichText = false;
            view.lineTemplate = wl;
            msg.gameObject.SetActive(false);
            sr.viewport = viewport;
            sr.content = content;
            view.scroll = sr;

            var line = Node("Line", body);
            Layout<HorizontalLayoutGroup>(line, 3);
            Size(line, minH: 24, prefH: 24);
            var input = Node("Input", line);
            view.input = Field(input, "Yaz, Enter ile gönder", 12);
            view.input.characterLimit = 120;
            Size(view.input, minH: 24, flexW: 1);
            view.send = Btn(line, "Send", "square_wood", "↵", 14);
            Size(view.send, minW: 26, prefW: 26, minH: 24);

            var strip = At(Node("Strip", wrap), BottomLeft, new Vector2(12, 96), new Vector2(128, 22));
            var stripImg = Img(strip, "button_wood_normal", Image.Type.Sliced, true);
            view.strip = strip.gameObject.AddComponent<Button>();
            view.strip.targetGraphic = stripImg;
            view.stripText = Txt(Stretch(Node("Label", strip), 4, 1, 4, 1), "", 12, Paper, TextAnchor.MiddleCenter, true);
            strip.gameObject.SetActive(false);
            return wrap.gameObject;
        }

        // ================= Chat bubble over a character (World/ChatBubbles) =================

        static GameObject BuildBubble()
        {
            var rt = Node("Bubble", null);
            rt.anchorMin = rt.anchorMax = Vector2.zero;
            rt.pivot = new Vector2(0.5f, 0f);
            rt.sizeDelta = new Vector2(120, 30);
            var view = rt.gameObject.AddComponent<BubbleView>();
            view.rect = rt;
            view.fade = rt.gameObject.AddComponent<CanvasGroup>();
            view.fade.blocksRaycasts = false;
            view.fade.interactable = false;
            Img(rt, "bubble");
            view.text = Txt(Stretch(Node("Text", rt), 10, 7, 10, 7), "", 13, Ink, TextAnchor.MiddleCenter);
            view.text.horizontalOverflow = HorizontalWrapMode.Wrap;
            view.text.supportRichText = false;
            // The tail points down at the speaker, its top row over the bubble's bottom edge.
            var tail = At(Node("Tail", rt), new Vector2(0.5f, 0f), new Vector2(0, 2), new Vector2(14, 8), new Vector2(0.5f, 1f));
            Img(tail, "bubble_tail", Image.Type.Simple);
            view.tail = tail.gameObject;
            return rt.gameObject;
        }

        static Color Hex(string h) => ColorUtility.TryParseHtmlString("#" + h, out var c) ? c : Color.magenta;
    }
}
