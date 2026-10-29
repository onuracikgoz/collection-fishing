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
        public const int Version = 1;
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
                disabledSprite = AssetDatabase.LoadAssetAtPath<Sprite>(Kit + $"button_{colour}_disabled.png") ?? S($"button_{colour}_normal"),
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
            var chatImg = Img(chat, "input_normal", Image.Type.Sliced, true);
            var field = chat.gameObject.AddComponent<InputField>();
            field.targetGraphic = chatImg;
            field.transition = Selectable.Transition.SpriteSwap;
            field.spriteState = new SpriteState { selectedSprite = S("input_focus"), highlightedSprite = S("input_normal") };
            field.characterLimit = 120;
            field.lineType = InputField.LineType.SingleLine;
            var fnav = field.navigation;
            fnav.mode = Navigation.Mode.None;
            field.navigation = fnav;
            var chatText = Txt(Stretch(Node("Text", chat), 8, 2, 8, 2), "", 14, Ink);
            chatText.supportRichText = false;
            chatText.horizontalOverflow = HorizontalWrapMode.Overflow;
            var placeholder = Txt(Stretch(Node("Placeholder", chat), 8, 2, 8, 2), "Enter ile yaz...  /w ad ile fısılda", 14, Faint);
            placeholder.fontStyle = FontStyle.Italic;
            field.textComponent = chatText;
            field.placeholder = placeholder;
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

        static Color Hex(string h) => ColorUtility.TryParseHtmlString("#" + h, out var c) ? c : Color.magenta;
    }
}
