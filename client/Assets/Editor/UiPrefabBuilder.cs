using System.IO;
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
    /// A prefab edited by hand is overwritten on the next build: move the change in here.
    /// </summary>
    [InitializeOnLoad]
    public static class UiPrefabBuilder
    {
        public const int Version = 3;
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
        static readonly Color Xp = Hex("a884f3");

        static Font font;
        static Font Font => font != null ? font : font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

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

        [MenuItem("CollectionGame/UI/Build Prefabs")]
        public static void Build()
        {
            if (AssetDatabase.LoadAssetAtPath<Sprite>(Kit + "window.png") == null)
            {
                Debug.LogWarning("[UI] Kit sprites not imported yet; prefabs not built");
                return;
            }
            Directory.CreateDirectory(Out);
            Save(BuildHud(), "Hud");
            Save(BuildBag(), "Bag");
            Save(BuildPopup(), "Popup");
            Save(BuildPanel("Quests", "Günlük görevler", new Vector2(600, 330), 1), "Quests");
            Save(BuildPanel("Settings", "Ayarlar", new Vector2(640, 470), 1), "Settings");
            Save(BuildPanel("Trade", "Takas", new Vector2(780, 480), 3, new[] { "Çanta", "Sen", "Karşı taraf" }), "Trade");
            Save(BuildPanel("TradeInvite", "Takas teklifi", new Vector2(400, 128), 1), "TradeInvite");
            Save(BuildPanel("Market", "Pazar", new Vector2(760, 520), 1), "Market");
            Save(BuildPanel("Stall", "Tezgah", new Vector2(660, 450), 1), "Stall");
            Save(BuildWhisper(), "Whisper");
            File.WriteAllText(VersionFile, Version + "\n");
            AssetDatabase.ImportAsset(VersionFile);
            AssetDatabase.SaveAssets();
            Debug.Log($"[UI] Built UI prefabs (version {Version}) in {Out}");
        }

        static void Save(GameObject go, string name)
        {
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

        static Text Txt(RectTransform rt, string text, int size, Color colour, TextAnchor align = TextAnchor.MiddleLeft, bool bold = false, bool shadow = false)
        {
            var t = rt.gameObject.AddComponent<Text>();
            t.font = Font;
            t.text = text;
            t.fontSize = size;
            t.color = colour;
            t.alignment = align;
            t.fontStyle = bold ? FontStyle.Bold : FontStyle.Normal;
            t.horizontalOverflow = HorizontalWrapMode.Overflow;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            if (shadow)
            {
                var sh = rt.gameObject.AddComponent<Shadow>();
                sh.effectColor = new Color(0, 0, 0, 0.75f);
                sh.effectDistance = new Vector2(1, -1);
            }
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
            placeholder.fontStyle = FontStyle.Italic;
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

            var plate = At(Node("Plate", rt), Top, new Vector2(0, 11), new Vector2(Mathf.Max(110, title.Length * 10 + 40), 24), Top);
            Img(plate, "button_wood_normal", Image.Type.Sliced, true);
            view.title = Txt(Stretch(Node("Title", plate), 4, 2, 4, 2), title, 15, Paper, TextAnchor.MiddleCenter, true);
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
            view.info = Txt(At(Node("Info", place), TopLeft, new Vector2(12, -30), new Vector2(276, 20)), "", 13, Paper);

            // Top right: score, coin, diamonds.
            var bal = At(Node("Balances", root), TopRight, new Vector2(-12, -12), new Vector2(350, 38));
            Img(bal, "box_dark");
            Icon(bal, "ScoreIcon", new Vector2(0, 0.5f), new Vector2(14, 0), Gold);
            view.score = Txt(At(Node("Score", bal), new Vector2(0, 0.5f), new Vector2(30, 0), new Vector2(90, 24), new Vector2(0, 0.5f)), "0", 15, Gold, TextAnchor.MiddleLeft, true);
            Icon(bal, "CoinIcon", new Vector2(0, 0.5f), new Vector2(128, 0), CoinColour);
            view.coin = Txt(At(Node("Coin", bal), new Vector2(0, 0.5f), new Vector2(144, 0), new Vector2(90, 24), new Vector2(0, 0.5f)), "0", 15, Paper, TextAnchor.MiddleLeft, true);
            Icon(bal, "DiamondIcon", new Vector2(0, 0.5f), new Vector2(244, 0), DiamondColour);
            view.diamond = Txt(At(Node("Diamond", bal), new Vector2(0, 0.5f), new Vector2(260, 0), new Vector2(80, 24), new Vector2(0, 0.5f)), "0", 15, DiamondColour, TextAnchor.MiddleLeft, true);

            // Chat log above the chat line.
            var log = At(Node("ChatLog", root), BottomLeft, new Vector2(505, 84), new Vector2(450, 88));
            Img(log, "box_dark");
            view.chatLog = Txt(Stretch(Node("Text", log), 10, 6, 10, 6), "", 13, Paper, TextAnchor.LowerLeft);
            view.chatLog.horizontalOverflow = HorizontalWrapMode.Wrap;
            view.chatLog.verticalOverflow = VerticalWrapMode.Truncate;
            view.chatLog.supportRichText = true;

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
            var lv = At(Node("Level", root), BottomLeft, new Vector2(6, 64), new Vector2(56, 22));
            Img(lv, "box_dark");
            view.level = Txt(Stretch(Node("Text", lv)), "Lv 1", 13, Paper, TextAnchor.MiddleCenter, true);
            view.xpText = Txt(At(Node("XpText", root), BottomRight, new Vector2(-420, 64), new Vector2(220, 18), new Vector2(1, 0)), "", 12, Paper, TextAnchor.MiddleRight, true, true);

            // Bottom bar.
            var bar = Node("Bar", root);
            bar.anchorMin = Vector2.zero;
            bar.anchorMax = new Vector2(1, 0);
            bar.pivot = new Vector2(0.5f, 0);
            bar.anchoredPosition = Vector2.zero;
            bar.sizeDelta = new Vector2(0, 58);
            Img(bar, "hud_bar", Image.Type.Sliced, true);

            Icon(bar, "EnergyIcon", BottomLeft, new Vector2(20, 36), Gold, 12);
            view.energyFill = Bar(At(Node("Energy", bar), BottomLeft, new Vector2(40, 30), new Vector2(112, 14)), "bar_fill_yellow", out _);
            view.energyText = Txt(At(Node("EnergyText", bar), BottomLeft, new Vector2(40, 8), new Vector2(150, 18)), "Enerji", 12, Paper);

            Icon(bar, "RodIcon", BottomLeft, new Vector2(200, 36), CoinColour, 12);
            view.rodFill = Bar(At(Node("Rod", bar), BottomLeft, new Vector2(220, 30), new Vector2(90, 14)), "bar_fill_green", out view.rodFillImage);
            view.rodGood = S("bar_fill_green");
            view.rodLow = S("bar_fill_red");
            view.rodText = Txt(At(Node("RodText", bar), BottomLeft, new Vector2(220, 8), new Vector2(150, 18)), "Olta", 12, Paper);

            view.bait = Slot(bar, "Bait");
            At((RectTransform)view.bait.transform, BottomLeft, new Vector2(385, 9), new Vector2(40, 40));
            view.baitText = Txt(At(Node("BaitText", bar), BottomLeft, new Vector2(431, 9), new Vector2(70, 40)), "Yem", 12, Paper);

            // Chat line: stretches between the bait and the window buttons.
            var chat = Node("Chat", bar);
            chat.anchorMin = Vector2.zero;
            chat.anchorMax = new Vector2(1, 0);
            chat.pivot = new Vector2(0, 0);
            chat.offsetMin = new Vector2(505, 12);
            chat.offsetMax = new Vector2(-418, 46);
            var field = Field(chat, "Enter ile yaz...  /w ad ile fısılda", 14);
            field.characterLimit = 120;
            view.chat = field;
            view.send = Btn(bar, "Send", "square_wood", "↵", 16);
            At((RectTransform)view.send.transform, BottomRight, new Vector2(-372, 12), new Vector2(34, 34), BottomRight);

            // Window buttons, right aligned; settings set apart at the far right.
            string[] names = { "Quests", "Market", "Friends", "Profile", "Book", "Bag" };
            string[] labels = { "Görev\n(G)", "Pazar\n(M)", "Dost\n(O)", "Profil\n(P)", "Defter\n(K)", "Çanta\n(B)" };
            var buttons = new Button[names.Length];
            for (var i = 0; i < names.Length; i++)
            {
                buttons[i] = Btn(bar, names[i], "flat", labels[i], 11);
                At((RectTransform)buttons[i].transform, BottomRight, new Vector2(-(12 + 48 + 12 + (names.Length - 1 - i) * 48), 9), new Vector2(44, 40), BottomRight);
            }
            view.quests = buttons[0];
            view.market = buttons[1];
            view.friends = buttons[2];
            view.profile = buttons[3];
            view.book = buttons[4];
            view.bag = buttons[5];
            var alert = At(Node("Alert", view.quests.transform), TopRight, new Vector2(-2, -2), new Vector2(8, 8));
            Solid(alert, Hex("e83b3b"));
            view.questsAlert = alert.gameObject;
            alert.gameObject.SetActive(false);
            view.settings = Btn(bar, "Settings", "flat", "Ayar", 11);
            At((RectTransform)view.settings.transform, BottomRight, new Vector2(-12, 9), new Vector2(44, 40), BottomRight);
            return root.gameObject;
        }

        // ================= Bag (draft canta-v2) =================

        static GameObject BuildBag()
        {
            var wrap = Stretch(Node("Bag", null));
            var view = wrap.gameObject.AddComponent<BagView>();
            view.window = Window(wrap, "Window", "Çanta", new Vector2(390, 300));
            At((RectTransform)view.window.transform, BottomRight, new Vector2(-14, 80), new Vector2(390, 300), BottomRight);
            var body = view.window.body;
            view.capacity = Txt(At(Node("Capacity", body), TopLeft, new Vector2(2, 0), new Vector2(120, 20)), "0 / 40", 14, Ink, TextAnchor.MiddleLeft, true);
            view.balance = Txt(At(Node("Balance", body), BottomRight, new Vector2(-2, 0), new Vector2(200, 18)), "", 12, Faint, TextAnchor.MiddleRight);

            var grid = Node("Grid", body);
            grid.anchorMin = new Vector2(0, 0);
            grid.anchorMax = new Vector2(1, 1);
            grid.offsetMin = new Vector2(0, 22);
            grid.offsetMax = new Vector2(0, -24);
            var layout = grid.gameObject.AddComponent<GridLayoutGroup>();
            layout.cellSize = new Vector2(40, 40);
            layout.spacing = new Vector2(4, 4);
            layout.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            layout.constraintCount = 8;
            view.grid = grid;
            view.slotTemplate = Slot(grid, "SlotTemplate");
            view.slotTemplate.gameObject.SetActive(false);

            view.footer = Txt(At(Node("Footer", body), BottomLeft, new Vector2(2, 0), new Vector2(150, 18)), "Sağ tık: işlemler", 12, Faint);
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

        // ================= Generic panel window (list screens) =================

        /// <summary>
        /// Window with header line, tabs (hidden until used), N scrolling columns of rows, footer line
        /// and footer bar. Centered; the player can drag it by the title plate.
        /// </summary>
        static GameObject BuildPanel(string name, string title, Vector2 size, int columns, string[] columnTitles = null)
        {
            var wrap = Stretch(Node(name, null));
            var view = wrap.gameObject.AddComponent<PanelView>();
            view.window = Window(wrap, "Window", title, size);
            At((RectTransform)view.window.transform, Center, new Vector2(0, 20), size, Center);
            var body = view.window.body;
            Layout<VerticalLayoutGroup>(body, 6).childForceExpandWidth = true;

            var head = Node("Header", body);
            Layout<HorizontalLayoutGroup>(head, 8, new RectOffset(0, 26, 0, 0), TextAnchor.MiddleLeft);
            Size(head, minH: 22);
            view.header = Label(head, "Text", "", 15, Ink, TextAnchor.MiddleLeft, true);
            Size(view.header, flexW: 1);
            view.headerRight = Label(head, "Right", "", 13, Ink, TextAnchor.MiddleRight, true);

            var tabs = Node("Tabs", body);
            Layout<HorizontalLayoutGroup>(tabs, 2, null, TextAnchor.LowerLeft);
            Size(tabs, minH: 24);
            view.tabs = tabs;
            var tab = Node("TabTemplate", tabs);
            var tabImg = Img(tab, "tab_inactive", Image.Type.Sliced, true);
            var tb = tab.gameObject.AddComponent<Button>();
            tb.targetGraphic = tabImg;
            var tnav = tb.navigation;
            tnav.mode = Navigation.Mode.None;
            tb.navigation = tnav;
            var ts = tab.gameObject.AddComponent<TabSprites>();
            ts.active = S("tab_active");
            ts.inactive = S("tab_inactive");
            ts.activeText = Ink;   // tab_active is the light linen tab
            ts.inactiveText = Paper; // tab_inactive is wood
            Txt(Stretch(Node("Label", tab), 6, 2, 6, 2), "Sekme", 13, Paper, TextAnchor.MiddleCenter, true);
            Size(tab, minH: 24, prefW: 130);
            view.tabTemplate = tb;
            tab.gameObject.SetActive(false);
            tabs.gameObject.SetActive(false);

            var cols = Node("Columns", body);
            var cl = Layout<HorizontalLayoutGroup>(cols, 12);
            cl.childForceExpandWidth = true;
            cl.childForceExpandHeight = true;
            Size(cols, flexH: 1);
            view.columns = new RectTransform[columns];
            view.columnTitles = new Text[columns];
            for (var i = 0; i < columns; i++)
            {
                var col = Node("Column" + i, cols);
                Layout<VerticalLayoutGroup>(col, 4).childForceExpandWidth = true;
                Size(col, flexW: 1, flexH: 1);
                if (columnTitles != null && i < columnTitles.Length)
                {
                    view.columnTitles[i] = Label(col, "Title", columnTitles[i], 14, Ink, TextAnchor.MiddleLeft, true);
                    Size(view.columnTitles[i], minH: 20);
                }
                var scroll = Node("Scroll", col);
                Size(scroll, flexH: 1, flexW: 1);
                var sr = scroll.gameObject.AddComponent<ScrollRect>();
                sr.horizontal = false;
                sr.movementType = ScrollRect.MovementType.Clamped;
                sr.scrollSensitivity = 24;
                var viewport = Stretch(Node("Viewport", scroll));
                viewport.gameObject.AddComponent<RectMask2D>();
                var hit = viewport.gameObject.AddComponent<Image>();
                hit.color = new Color(0, 0, 0, 0);
                var content = Node("Content", viewport);
                content.anchorMin = new Vector2(0, 1);
                content.anchorMax = new Vector2(1, 1);
                content.pivot = new Vector2(0.5f, 1);
                content.offsetMin = content.offsetMax = Vector2.zero;
                Layout<VerticalLayoutGroup>(content, 3).childForceExpandWidth = true;
                content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
                sr.viewport = viewport;
                sr.content = content;
                view.columns[i] = content;
            }
            view.rowTemplate = BuildRow(view.columns[0]);
            view.rowTemplate.gameObject.SetActive(false);

            view.footer = Label(body, "Footer", "", 12, Faint);
            view.footer.horizontalOverflow = HorizontalWrapMode.Wrap;
            Size(view.footer, minH: 16);
            var bar = Node("FooterBar", body);
            Layout<HorizontalLayoutGroup>(bar, 6, null, TextAnchor.MiddleRight);
            Size(bar, minH: 28);
            view.footerBar = bar;
            view.wood = Templ(Btn(bar, "Wood", "wood", "Tamam"), 110, 28);
            view.green = Templ(Btn(bar, "Green", "green", "Tamam"), 110, 28);
            view.red = Templ(Btn(bar, "Red", "red", "Tamam"), 110, 28);
            var input = Node("Input", bar);
            view.input = Field(input, "");
            Size(view.input, minH: 26, prefW: 120);
            input.gameObject.SetActive(false);
            return wrap.gameObject;
        }

        static Button Templ(Button b, float w, float h)
        {
            Size(b, minH: h, prefW: w);
            b.gameObject.SetActive(false);
            return b;
        }

        static RowView BuildRow(Transform parent)
        {
            var row = Node("RowTemplate", parent);
            Img(row, "card");
            Layout<HorizontalLayoutGroup>(row, 6, new RectOffset(6, 6, 4, 4), TextAnchor.MiddleLeft);
            Size(row, minH: 32);
            var view = row.gameObject.AddComponent<RowView>();
            view.mark = Slot(row, "Mark", 26);
            Size(view.mark, minW: 26, minH: 26, prefW: 26, prefH: 26);
            view.mark.label.fontSize = 8;

            var col = Node("Text", row);
            Layout<VerticalLayoutGroup>(col, 1, null, TextAnchor.MiddleLeft).childForceExpandWidth = true;
            Size(col, flexW: 1);
            view.title = Label(col, "Title", "", 13, Ink);
            view.title.horizontalOverflow = HorizontalWrapMode.Wrap;
            view.sub = Label(col, "Sub", "", 11, Faint);
            view.sub.horizontalOverflow = HorizontalWrapMode.Wrap;
            var back = Node("Bar", col);
            Size(back, minH: 8, prefH: 8);
            view.barFill = Bar(back, "bar_fill_green", out _);
            view.bar = back;

            view.right = Label(row, "Right", "", 13, Ink, TextAnchor.MiddleRight, true);
            var tail = Node("Tail", row);
            Layout<HorizontalLayoutGroup>(tail, 3, null, TextAnchor.MiddleRight);
            view.tail = tail;
            view.wood = Templ(Btn(tail, "Wood", "wood", "", 12), 70, 22);
            view.green = Templ(Btn(tail, "Green", "green", "", 12), 70, 22);
            view.red = Templ(Btn(tail, "Red", "red", "", 12), 70, 22);
            var input = Node("Input", tail);
            view.input = Field(input, "", 12);
            Size(view.input, minH: 22, prefW: 70);
            input.gameObject.SetActive(false);
            return view;
        }

        // ================= Whisper window =================

        static GameObject BuildWhisper()
        {
            var wrap = Stretch(Node("Whisper", null));
            var view = wrap.gameObject.AddComponent<WhisperView>();
            var size = new Vector2(300, 210);
            view.window = Window(wrap, "Window", "Fısıltı", size);
            At((RectTransform)view.window.transform, BottomRight, new Vector2(-420, 190), size, BottomRight);
            view.plateImage = view.window.plate.GetComponent<Image>();
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
            view.log = Txt(content, "", 12, Ink, TextAnchor.UpperLeft);
            view.log.horizontalOverflow = HorizontalWrapMode.Wrap;
            view.log.supportRichText = true;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
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

        static Color Hex(string h) => ColorUtility.TryParseHtmlString("#" + h, out var c) ? c : Color.magenta;
    }
}
