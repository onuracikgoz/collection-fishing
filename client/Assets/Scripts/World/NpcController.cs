using System;
using System.Collections.Generic;
using CollectionGame.UI;
using UnityEngine;
using UnityEngine.InputSystem;

namespace CollectionGame.World
{
    /// <summary>
    /// The NPCs of the map (Resources/Npcs.json): Görevci (quests), Balıkçı Tüccar (sell, salvage, shop),
    /// Zanaatkar (craft, merge), Bankacı (stash). Their windows open only next to them: walk up and
    /// press E, or click the NPC (the player walks there and it opens on arrival). Walking away closes it.
    /// The server still decides every result; distance rules on the server are an open question.
    /// </summary>
    public sealed class NpcController
    {
        [Serializable] sealed class NpcData { public string id, kind, name; public float x, y, range; }
        [Serializable] sealed class NpcFile { public NpcData[] npcs; }

        /// <summary>What a kind of NPC opens, set by WorldController.</summary>
        public sealed class Window
        {
            public Func<bool> IsOpen;
            public Action Open, Close;
        }

        sealed class Npc
        {
            public NpcData Data;
            public CharacterView View;
            public Vector2 Pos => new Vector2(Data.x, Data.y);
        }

        readonly List<Npc> npcs = new List<Npc>();
        readonly Dictionary<string, Window> windows = new Dictionary<string, Window>();
        Npc talking, walkingTo;

        public NpcController(Transform parent)
        {
            var file = Resources.Load<TextAsset>("Npcs");
            var data = file != null ? JsonUtility.FromJson<NpcFile>(file.text) : null;
            if (data?.npcs == null)
            {
                Debug.LogWarning("[NPC] Resources/Npcs.json missing");
                return;
            }
            foreach (var d in data.npcs)
            {
                var view = CharacterView.Create(parent, "npc:" + d.id, d.name);
                view.SetState(new Vector2(d.x, d.y), "down", false);
                npcs.Add(new Npc { Data = d, View = view });
            }
        }

        public void Bind(string kind, Window w) => windows[kind] = w;

        /// <summary>The quest giver shows a "!" while a reward waits.</summary>
        public bool QuestsReady { get; set; }

        public IEnumerable<CharacterView> Views
        {
            get { foreach (var n in npcs) yield return n.View; }
        }

        /// <summary>Every NPC for the mini map: kind (merchant, crafter, quests, banker), name, server tile position.</summary>
        public IEnumerable<(string kind, string name, Vector2 pos)> Markers
        {
            get { foreach (var n in npcs) yield return (n.Data.kind, n.Data.name, n.Pos); }
        }

        public bool IsNpc(CharacterView v) => v != null && v.Id != null && v.Id.StartsWith("npc:");

        /// <summary>The NPC this player can talk to now, or null.</summary>
        Npc Nearest(Vector2 me)
        {
            Npc best = null;
            var bestD = float.MaxValue;
            foreach (var n in npcs)
            {
                var d = Vector2.Distance(me, n.Pos);
                if (d <= n.Data.range && d < bestD)
                {
                    best = n;
                    bestD = d;
                }
            }
            return best;
        }

        /// <summary>Call every frame. E talks to the nearest NPC; walking away closes its window.</summary>
        public void Update(Vector2 me, bool typing)
        {
            if (talking != null && windows.TryGetValue(talking.Data.kind, out var tw))
            {
                if (!tw.IsOpen()) talking = null;
                else if (Vector2.Distance(me, talking.Pos) > talking.Data.range + 0.5f)
                {
                    tw.Close();
                    talking = null;
                }
            }
            if (walkingTo != null && Vector2.Distance(me, walkingTo.Pos) <= walkingTo.Data.range)
            {
                Talk(walkingTo);
                walkingTo = null;
            }
            var k = Keyboard.current;
            if (typing || k == null || !k.eKey.wasPressedThisFrame) return;
            if (talking != null && windows.TryGetValue(talking.Data.kind, out var open) && open.IsOpen())
            {
                open.Close();
                talking = null;
                return;
            }
            var near = Nearest(me);
            if (near != null) Talk(near);
        }

        void Talk(Npc n)
        {
            if (!windows.TryGetValue(n.Data.kind, out var w)) return;
            foreach (var other in windows.Values)
                if (other != w && other.IsOpen()) other.Close();
            w.Open();
            talking = n;
        }

        /// <summary>
        /// A click at this server point: true when it hit an NPC. Near: talk now; far: the caller walks
        /// there and the window opens on arrival.
        /// </summary>
        public bool Click(Vector2 point, Vector2 me)
        {
            foreach (var n in npcs)
            {
                var d = point - n.Pos;
                // The sprite stands on its tile and is about two tiles tall (server y grows down).
                if (Mathf.Abs(d.x) > 0.6f || d.y > 0.5f || d.y < -1.8f) continue;
                if (Vector2.Distance(me, n.Pos) <= n.Data.range) Talk(n);
                else walkingTo = n;
                return true;
            }
            return false;
        }

        /// <summary>
        /// Opens <paramref name="open"/> as this kind of NPC's window when the player stands next to it
        /// (e.g. the HUD repair button opens the merchant's shop); false when too far.
        /// </summary>
        public bool TalkIfNear(string kind, Vector2 me, Action open)
        {
            foreach (var n in npcs)
            {
                if (n.Data.kind != kind || Vector2.Distance(me, n.Pos) > n.Data.range) continue;
                open();
                talking = n;
                return true;
            }
            return false;
        }

        /// <summary>The player chose to walk somewhere else.</summary>
        public void CancelWalk() => walkingTo = null;

        /// <summary>The name over an NPC: its role, and "E" when close enough.</summary>
        public string Label(CharacterView v, Vector2 me)
        {
            foreach (var n in npcs)
            {
                if (n.View != v) continue;
                var mark = n.Data.kind == "quests" && QuestsReady ? "! " : "";
                return Vector2.Distance(me, n.Pos) <= n.Data.range ? $"{mark}{n.Data.name} [E]" : mark + n.Data.name;
            }
            return v.DisplayName;
        }

        public void Destroy()
        {
            foreach (var n in npcs)
                if (n.View != null) UnityEngine.Object.Destroy(n.View.gameObject);
            npcs.Clear();
        }
    }
}
