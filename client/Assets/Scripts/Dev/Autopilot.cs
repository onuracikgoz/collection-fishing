using System;
using System.Collections;
using CollectionGame.Fishing;
using CollectionGame.Net;
using CollectionGame.World;
using UnityEngine;

namespace CollectionGame.Dev
{
    /// <summary>
    /// Test driver for builds, started from the command line (see client/README.md):
    ///   -cgUser NAME -cgServer Mercan [-cgBot fish|walk] [-cgSay TEXT] [-cgShot FILE.png] [-cgQuit SECONDS]
    /// Logs in, joins, walks to the pier, optionally fishes once, chats, takes a
    /// screenshot and quits, writing "[Autopilot]" lines to the player log. It only
    /// sends what a player could send; the server still decides everything.
    /// </summary>
    public class Autopilot : MonoBehaviour
    {
        /// <summary>
        /// A test argument: "-cgUser bob" on the command line, or "?cgUser=bob" in the
        /// page address of a web build.
        /// </summary>
        public static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (var i = 0; i < args.Length - 1; i++)
                if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase)) return args[i + 1];

            var url = Application.absoluteURL ?? "";
            var q = url.IndexOf('?');
            if (q < 0) return null;
            foreach (var pair in url.Substring(q + 1).Split('&'))
            {
                var eq = pair.IndexOf('=');
                if (eq > 0 && string.Equals("-" + pair.Substring(0, eq), name, StringComparison.OrdinalIgnoreCase))
                    return Uri.UnescapeDataString(pair.Substring(eq + 1).Replace('+', ' '));
            }
            return null;
        }

        public static bool Enabled => Arg("-cgUser") != null;

        // Pier end and a spot next to it (docs/tasarim/16-ilk-harita.md, LakeMap.Pier).
        static readonly Vector2[] FisherPath = { new Vector2(70f, 50.5f), new Vector2(70f, 48f), new Vector2(85.5f, 48f) };
        static readonly Vector2[] WalkerPath = { new Vector2(70f, 50.5f), new Vector2(70f, 48.5f), new Vector2(82f, 48.5f) };

        WorldController world;

        public static void Attach(WorldController world)
        {
            var bot = world.gameObject.AddComponent<Autopilot>();
            bot.world = world;
        }

        void Log(string msg) => Debug.Log($"[Autopilot] {msg}");

        IEnumerator Start()
        {
            var mode = Arg("-cgBot") ?? "walk";
            var quitAfter = float.TryParse(Arg("-cgQuit") ?? "", System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var q) ? q : 0f;
            if (quitAfter > 0f) StartCoroutine(QuitLater(quitAfter));

            while (!world.Ready) yield return null;
            Log($"joined at {world.MyPosition}");

            foreach (var p in mode == "fish" ? FisherPath : WalkerPath)
            {
                world.WalkTo(p);
                yield return new WaitForSeconds(0.2f);
                var until = Time.time + 15f;
                while (world.Walking && Time.time < until) yield return null;
            }
            Log($"arrived at {world.MyPosition}, corrections {world.Corrections}");

            var say = Arg("-cgSay");
            if (!string.IsNullOrEmpty(say)) world.Say(say);

            if (mode == "fish") yield return Fish();

            yield return new WaitForSeconds(1.5f);
            var shot = Arg("-cgShot");
            if (!string.IsNullOrEmpty(shot))
            {
                ScreenCapture.CaptureScreenshot(shot);
                Log($"screenshot {shot}");
            }
            yield return new WaitForSeconds(0.5f);
            Log($"summary others {world.OthersInView}, bubbles {world.BubblesHeard}, corrections {world.Corrections}, energy {world.Fishing.Energy}/{world.Fishing.EnergyMax}");
        }

        IEnumerator Fish()
        {
            var fishing = world.Fishing;
            // Play the reel by keeping the bar's middle under the fish.
            fishing.BotReel = reel => reel.Fish > reel.Bar + reel.Params.barSize / 2;

            for (var attempt = 1; attempt <= 3; attempt++)
            {
                fishing.Cast(world.MyPosition + new Vector2(3f, 0f));
                var until = Time.time + 40f;
                while (fishing.State != FishingController.Phase.Bite && fishing.State != FishingController.Phase.Idle && Time.time < until)
                    yield return null;
                if (fishing.State == FishingController.Phase.Bite)
                {
                    Log("bite, hooking");
                    fishing.Hook();
                }
                // A picture of the reel game halfway through, next to the final -cgShot.
                var shot = Arg("-cgShot");
                if (!string.IsNullOrEmpty(shot))
                {
                    while (fishing.State == FishingController.Phase.Hooked && Time.time < until) yield return null;
                    if (fishing.State == FishingController.Phase.Reeling)
                    {
                        yield return new WaitForSeconds(1f);
                        ScreenCapture.CaptureScreenshot(shot.Replace(".png", "-reel.png"));
                    }
                }
                while (fishing.State != FishingController.Phase.Idle && Time.time < until) yield return null;
                var end = fishing.LastEnd;
                Log($"attempt {attempt}: {fishing.LastOutcome} {end?.reason} {end?.defId}");
                if (fishing.LastOutcome == FishOutcome.Caught) break;
                yield return new WaitForSeconds(1f);
            }

            fishing.BagOpen = true;
            fishing.RefreshBag();
            yield return new WaitForSeconds(1f);
            var bag = fishing.Bag;
            if (bag != null)
                Log($"bag {bag.slotsUsed}/{bag.slotsMax}, items {bag.items?.Length ?? 0}, stacks {bag.stacks?.Length ?? 0}, energy {bag.energy}/{bag.energyMax}");
        }

        IEnumerator QuitLater(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            Log("quit");
            Application.Quit();
        }
    }
}
