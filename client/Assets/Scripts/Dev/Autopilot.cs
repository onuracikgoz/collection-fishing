using System;
using System.Collections;
using System.Linq;
using CollectionGame.Collection;
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
            else yield return LookAtOthers();

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

            // Keep fishing until a Tier item (a book record) comes up; junk does not count.
            for (var attempt = 1; attempt <= 8; attempt++)
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
                if (fishing.LastOutcome == FishOutcome.Caught && end?.item != null && !string.IsNullOrEmpty(end.item.instanceId))
                {
                    if (end.book != null && !string.IsNullOrEmpty(end.book.page)) Log($"book {end.book.kind} on {end.book.page}, better {end.book.better}, complete {end.book.pageComplete}");
                    break;
                }
                yield return new WaitForSeconds(1f);
            }

            // Phase 3: a better copy is swapped in, then the book and the profile card.
            var collection = world.Collection;
            yield return new WaitForSeconds(0.5f);
            if (collection.SwapOffer != null)
            {
                Log("swapping the cleaner copy into the book");
                collection.AcceptSwap();
                yield return new WaitForSeconds(1f);
                Log($"book result {collection.LastResult?.ok} {collection.LastResult?.reason}");
            }
            collection.OpenBook(null, null);
            yield return WaitFor(() => collection.Book != null && collection.MyProfile != null, 5f);
            var book = collection.Book;
            if (book != null)
            {
                var filled = book.pages.SelectMany(p => p.records).Where(r => r.state == RecordState.Filled).Select(r => r.defId).ToArray();
                Log($"book score {book.score}, luck {book.luck}, pages {string.Join(" ", book.pages.Select(p => $"{p.id}:{p.found}/{p.total}"))}, filled {filled.Length}");
                var page = Array.FindIndex(book.pages, p => p.records.Any(r => r.state == RecordState.Filled));
                if (page >= 0) collection.PageIndex = page;
                if (filled.Length > 0)
                {
                    collection.SetShowcase(filled.Take(CollectionController.ShowcaseMax).ToArray());
                    yield return new WaitForSeconds(1f);
                }
            }
            collection.OpenProfile(null);
            yield return WaitFor(() => collection.Profile != null, 5f);
            var card = collection.Profile;
            if (card != null) Log($"profile {card.username}, score {card.score}, showcase {card.showcase?.Length ?? 0}");

            fishing.BagOpen = true;
            fishing.RefreshBag();
            yield return new WaitForSeconds(1f);
            var bag = fishing.Bag;
            if (bag != null)
                Log($"bag {bag.slotsUsed}/{bag.slotsMax}, items {bag.items?.Length ?? 0}, stacks {bag.stacks?.Length ?? 0}, energy {bag.energy}/{bag.energyMax}");
        }

        /// <summary>Walker: opens the first other player's profile card and book.</summary>
        IEnumerator LookAtOthers()
        {
            // -cgLookAfter SECONDS: give a fishing bot time to fill its book first.
            if (float.TryParse(Arg("-cgLookAfter") ?? "", System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var wait))
                yield return new WaitForSeconds(wait);
            yield return WaitFor(() => world.OtherIds.Any(), 10f);
            var other = world.OtherIds.FirstOrDefault();
            if (other == null) yield break;
            var collection = world.Collection;
            collection.OpenProfile(other);
            yield return WaitFor(() => collection.Profile != null, 5f);
            var card = collection.Profile;
            if (card == null) yield break;
            Log($"other profile {card.username}, score {card.score}, showcase {card.showcase?.Length ?? 0}");
            collection.OpenBook(other, card.username);
            yield return WaitFor(() => collection.Book != null, 5f);
            if (collection.Book != null) Log($"other book score {collection.Book.score}");
        }

        static IEnumerator WaitFor(Func<bool> done, float seconds)
        {
            var until = Time.time + seconds;
            while (!done() && Time.time < until) yield return null;
        }

        IEnumerator QuitLater(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            Log("quit");
            Application.Quit();
        }
    }
}
