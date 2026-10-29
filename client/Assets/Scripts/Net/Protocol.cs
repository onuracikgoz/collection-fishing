// Mirrors docs/protokol.md and server/src/protocol.ts. Change the doc first.
// Message bodies are JSON; field names must match the server exactly (JsonUtility uses field names).
using System;

namespace CollectionGame.Net
{
    public static class Protocol
    {
        public const int Version = 1;
    }

    public static class OpCode
    {
        public const long Move = 1;
        public const long Snapshot = 2;
        public const long PlayerEnter = 3;
        public const long PlayerLeave = 4;
        public const long Say = 5;
        public const long Bubble = 6;
        public const long Correction = 7;
        public const long Welcome = 8;
        // Faz 2: fishing
        public const long Cast = 9;
        public const long Bobber = 10;
        public const long Hook = 11;
        public const long ReelStart = 12;
        public const long ReelDone = 13;
        public const long FishEnd = 14;
        public const long Cancel = 15;
        // Faz 3: Collection Book
        public const long BookPlace = 16;
        public const long BookResult = 17;
        // Faz 3: friends, teleport, emotes
        public const long GotoFriend = 18;
        public const long Teleport = 19;
        public const long Emote = 20;
        public const long EmoteShow = 21;
        // Faz 4: economy, craft, shop, stash
        public const long Sell = 22;
        public const long Salvage = 23;
        public const long EconomyResult = 24;
        public const long Merge = 25;
        public const long Craft = 26;
        public const long CraftResult = 27;
        public const long RepairRod = 28;
        public const long BuyBait = 29;
        public const long ShopResult = 30;
        public const long StashOpen = 31;
        public const long StashPut = 32;
        public const long StashTake = 33;
        public const long StashExpand = 34;
        public const long StashResult = 35;
        public const long EmoteStatus = 36;
        public const long EmoteStatusShow = 37;
        public const long Announce = 38;
        public const long TradeOffer = 39;
        public const long TradeReply = 40;
        public const long TradeSet = 41;
        public const long TradeLock = 42;
        public const long TradeConfirm = 43;
        public const long TradeCancel = 44;
        public const long TradeInvite = 45;
        public const long TradeState = 46;
        public const long TradeEnd = 47;
        public const long ItemLock = 48;
        public const long ItemLockResult = 49;
        public const long StallOpen = 50;
        public const long StallRecall = 51;
        public const long StallView = 52;
        public const long StallBuy = 53;
        public const long StallList = 54;
        public const long StallState = 55;
        public const long StallResult = 56;
        public const long QuestState = 57;
        public const long QuestClaim = 58;
        public const long QuestClaimResult = 59;
    }

    public static class ErrorCode
    {
        public const string BadRequest = "BAD_REQUEST";
        public const string ProtocolMismatch = "PROTOCOL_MISMATCH";
        public const string ServerFull = "SERVER_FULL";
        public const string RateLimited = "RATE_LIMITED";
        public const string AccountRecentlyDeleted = "ACCOUNT_RECENTLY_DELETED";
        public const string NameReserved = "NAME_RESERVED";
        // Whisper and reports (docs/protokol.md, Fısıltı)
        public const string Muted = "MUTED";
        public const string NotFound = "NOT_FOUND";
        public const string Self = "SELF";
        public const string NotAllowed = "NOT_ALLOWED";
        public const string YouBlocked = "YOU_BLOCKED";
        public const string LevelTooLow = "LEVEL_TOO_LOW";
        public const string Offline = "OFFLINE";
    }

    /// <summary>"up", "down", "left" or "right". Server y grows downward, so "down" is +y.</summary>
    public static class Dir
    {
        public const string Up = "up";
        public const string Down = "down";
        public const string Left = "left";
        public const string Right = "right";
    }

    [Serializable]
    public class HealthcheckResponse
    {
        public bool ok;
        public long serverTime;
        public int protocolVersion;
    }

    [Serializable]
    public class ServerInfo
    {
        public string matchId;
        public string name;
        public string language;
        public int players;
        public int capacity;
    }

    [Serializable]
    public class ListServersResponse
    {
        public ServerInfo[] servers;
    }

    [Serializable]
    public class PlayerView
    {
        public string id;
        public float x;
        public float y;
        public string dir;
        public bool moving;
    }

    /// <summary>C → S, op 1.</summary>
    [Serializable]
    public class MoveMsg
    {
        public int seq;
        public float x;
        public float y;
        public string dir;
        public bool moving;
    }

    /// <summary>S → C, op 2.</summary>
    [Serializable]
    public class SnapshotMsg
    {
        public long t;
        public PlayerView[] players;
    }

    /// <summary>S → C, op 3.</summary>
    [Serializable]
    public class PlayerEnterMsg : PlayerView
    {
        public string name;
        public string characterId;
        /// <summary>Set if the player is fishing. JsonUtility fills absent objects with defaults: check band.</summary>
        public BobberPos bobber;
        /// <summary>Status emote worn above the head; empty when none.</summary>
        public string status;
    }

    /// <summary>S → C, op 4.</summary>
    [Serializable]
    public class PlayerLeaveMsg
    {
        public string id;
    }

    /// <summary>C → S, op 5.</summary>
    [Serializable]
    public class SayMsg
    {
        public string text;
    }

    /// <summary>S → C, op 6.</summary>
    [Serializable]
    public class BubbleMsg
    {
        public string id;
        public string text;
    }

    /// <summary>S → C, op 7.</summary>
    [Serializable]
    public class CorrectionMsg
    {
        public int seq;
        public float x;
        public float y;
    }

    [Serializable]
    public class WelcomeYou
    {
        public string id;
        public float x;
        public float y;
    }

    /// <summary>S → C, op 8.</summary>
    [Serializable]
    public class WelcomeMsg
    {
        public WelcomeYou you;
        public string serverName;
        public int energy;
        public int energyMax;
        /// <summary>Faz 4.</summary>
        public RodView rod;
        /// <summary>Status emote worn right now; empty when none.</summary>
        public string status;
        /// <summary>Non-free status emotes this player owns.</summary>
        public string[] emotesOwned;
        public int level;
        /// <summary>XP inside the level.</summary>
        public int xp;
        /// <summary>XP this level needs; 0 at the top level.</summary>
        public int xpNext;
    }

    // --- Faz 2: fishing (docs/protokol.md, Balık tutma) ---

    public static class Band
    {
        public const string Shore = "shore";
        public const string Mid = "mid";
        public const string Deep = "deep";
    }

    public static class BobberState
    {
        public const string Cast = "cast";
        public const string Twitch = "twitch";
        public const string Bite = "bite";
    }

    public static class FishOutcome
    {
        public const string Caught = "caught";
        public const string Escaped = "escaped";
        public const string Missed = "missed";
        public const string Cancelled = "cancelled";
        public const string Rejected = "rejected";
    }

    [Serializable]
    public class BobberPos
    {
        public float x;
        public float y;
        public string band;
    }

    /// <summary>C → S, op 9: where the bobber should land (tiles), basic bait.</summary>
    [Serializable]
    public class CastMsg
    {
        public float x;
        public float y;
    }

    /// <summary>
    /// C → S, op 9 with a special bait (Faz 4). A separate class because JsonUtility
    /// writes a null string as "", which the server refuses as a bait id.
    /// </summary>
    [Serializable]
    public class CastBaitMsg
    {
        public float x;
        public float y;
        public string bait;
    }

    /// <summary>S → C, op 10.</summary>
    [Serializable]
    public class BobberMsg
    {
        public string id;
        public float x;
        public float y;
        public string band;
        public string state;
        /// <summary>Only in the fisher's own "cast" message: energy after the cast (0 elsewhere).</summary>
        public int energy;
        /// <summary>Faz 4, own "cast" message with a special bait: what is left. defId empty otherwise.</summary>
        public ItemStack bait;
    }

    /// <summary>C → S, op 11 and 15 (HOOK, CANCEL) have an empty body.</summary>
    [Serializable]
    public class EmptyMsg
    {
    }

    [Serializable]
    public class ReelParams
    {
        public int barSize;
        public int lift;
        public int gravity;
        public int maxVel;
        public int fishSpeed;
        public int retargetSteps;
        public int gain;
        public int loss;
        public int maxSteps;
        public int maxMs;
    }

    /// <summary>S → C, op 12.</summary>
    [Serializable]
    public class ReelStartMsg
    {
        public long seed; // unsigned 32-bit
        public ReelParams @params;
    }

    /// <summary>C → S, op 13: press / release toggle times in ms, first one is a press.</summary>
    [Serializable]
    public class ReelDoneMsg
    {
        public int[] inputs;
    }

    [Serializable]
    public class ItemInstance
    {
        public string instanceId;
        public string defId;
        public string tier;
        public float @float;
        public string source;
        public long obtainedAt;
        /// <summary>Protected by its owner: cannot be sold, salvaged, merged, crafted or traded.</summary>
        public bool locked;
    }

    [Serializable]
    public class ItemStack
    {
        public string defId;
        public int count;
    }

    /// <summary>S → C, op 14. reason, item, stack and energy only reach the fisher.</summary>
    [Serializable]
    public class FishEndMsg
    {
        public string id;
        public string outcome;
        public string defId;
        public string reason;
        public ItemInstance item;
        public ItemStack stack;
        public int energy;
        /// <summary>Book outcome for a Tier item on a book page; page is empty when absent.</summary>
        public FishBookMsg book;
        /// <summary>Faz 4: the rod after this catch when it wore; max is 0 when absent.</summary>
        public RodView rod;
        /// <summary>XP for this catch; gained is 0 when absent or when the cast had no energy.</summary>
        public XpGainMsg xpGain;
    }

    [Serializable]
    public class LevelUpInfo
    {
        public int level;
        /// <summary>What the new level opens: "trade"...</summary>
        public string[] unlocks;
    }

    [Serializable]
    public class XpGainMsg
    {
        public int gained;
        public int level;
        /// <summary>XP inside the level.</summary>
        public int xp;
        /// <summary>XP this level needs; 0 at the top level.</summary>
        public int xpNext;
        /// <summary>level is 0 when this catch did not reach a new level.</summary>
        public LevelUpInfo levelUp;
    }

    // --- Faz 3: Collection Book (docs/protokol.md, Collection Book) ---

    public static class BookKind
    {
        public const string Discovered = "discovered";
        public const string Copy = "copy";
    }

    public static class RecordState
    {
        public const string Unknown = "unknown";
        public const string Found = "found";
        public const string Filled = "filled";
    }

    [Serializable]
    public class FishBookMsg
    {
        public string page;
        /// <summary>discovered: first copy, now in its slot. copy: went to the bag.</summary>
        public string kind;
        public bool pageComplete;
        /// <summary>copy: cleaner than the slot's copy, or the slot is empty.</summary>
        public bool better;
        public float luck;
        public int score;
    }

    /// <summary>C → S, op 16: put a bag item in its book slot.</summary>
    [Serializable]
    public class BookPlaceMsg
    {
        public string instanceId;
    }

    /// <summary>S → C, op 17. slot / previous have an empty instanceId when absent.</summary>
    [Serializable]
    public class BookResultMsg
    {
        public bool ok;
        public string reason;
        public string defId;
        public string page;
        public ItemInstance slot;
        public ItemInstance previous;
        public int score;
    }

    [Serializable]
    public class BookRecord
    {
        /// <summary>Empty for unknown records.</summary>
        public string defId;
        public string state;
        public ItemInstance item;
    }

    [Serializable]
    public class BookPage
    {
        public string id;
        public int total;
        public int found;
        public int filled;
        public BookRecord[] records;
    }

    /// <summary>get_book RPC.</summary>
    [Serializable]
    public class BookResponse
    {
        public string userId;
        public BookPage[] pages;
        public float luck;
        public int score;
    }

    /// <summary>get_profile / set_profile RPC.</summary>
    [Serializable]
    public class ProfileResponse
    {
        public string userId;
        public string username;
        public int score;
        public string[] pagesComplete;
        public int level;
        public ItemInstance[] showcase;
        public string hunting;
    }

    // --- Faz 3: friends, teleport, emotes (docs/protokol.md, Arkadaşlar, ışınlanma, emote) ---

    public static class Emotes
    {
        public const string Wave = "wave";
        public const string Clap = "clap";
        public const string Dance = "dance";
        public const string Sit = "sit";
        public const string Laugh = "laugh";
        public const string ShowFish = "show_fish";
        /// <summary>Keys 1-6 in this order. The server drops anything else (no flirting emotes, 13+).</summary>
        public static readonly string[] All = { Wave, Clap, Dance, Sit, Laugh, ShowFish };
    }

    /// <summary>C → S, op 18: "Yanına git" to a friend on this server.</summary>
    [Serializable]
    public class GotoFriendMsg
    {
        public string userId;
    }

    /// <summary>S → C, op 19. reason set = refused (NOT_FRIEND, NOT_HERE, NO_SPOT, RATE_LIMITED), x/y is where we are.</summary>
    [Serializable]
    public class TeleportMsg
    {
        public float x;
        public float y;
        public string reason;
    }

    /// <summary>C → S, op 20.</summary>
    [Serializable]
    public class EmoteMsg
    {
        public string emote;
    }

    /// <summary>S → C, op 21. defId only for show_fish.</summary>
    [Serializable]
    public class EmoteShowMsg
    {
        public string id;
        public string emote;
        public string defId;
    }

    /// <summary>C → S, op 36. emote empty = remove the status emote (JsonUtility cannot send null).</summary>
    [Serializable]
    public class EmoteStatusMsg
    {
        public string emote;
    }

    /// <summary>S → C, op 37. emote empty = none worn. reason set = refused (NOT_OWNED, RATE_LIMITED) and only to us, emote is what we still wear.</summary>
    [Serializable]
    public class EmoteStatusShowMsg
    {
        public string id;
        public string emote;
        public string reason;
    }

    /// <summary>S → C, op 38. Server-wide announcement; kind is "rare_catch" for now. condition is a name only, never the raw Float.</summary>
    [Serializable]
    public class AnnounceMsg
    {
        public string kind;
        public string id;
        public string name;
        public string defId;
        public string tier;
        public string condition;
    }

    /// <summary>C → S, op 48.</summary>
    [Serializable]
    public class ItemLockMsg
    {
        public string instanceId;
        public bool locked;
    }

    /// <summary>S → C, op 49. Only to the asker. reason: BAD_REQUEST, NOT_OWNED.</summary>
    [Serializable]
    public class ItemLockResultMsg
    {
        public string instanceId;
        public bool locked;
        public bool ok;
        public string reason;
    }

    // --- Faz 5: trade (docs/protokol.md, Takas) ---

    /// <summary>C → S, op 39.</summary>
    [Serializable]
    public class TradeOfferMsg
    {
        public string userId;
    }

    /// <summary>C → S, op 40.</summary>
    [Serializable]
    public class TradeReplyMsg
    {
        public bool accept;
    }

    /// <summary>C → S, op 41: my whole side of the window.</summary>
    [Serializable]
    public class TradeSetMsg
    {
        public string[] items;
        public ItemStack[] stacks;
        public int coin;
    }

    /// <summary>C → S, op 42.</summary>
    [Serializable]
    public class TradeLockMsg
    {
        public bool locked;
    }

    [Serializable]
    public class TradeOfferView
    {
        public ItemInstance[] items;
        public ItemStack[] stacks;
        public int coin;
    }

    /// <summary>S → C, op 45.</summary>
    [Serializable]
    public class TradeInviteMsg
    {
        public string tradeId;
        public string from;
        public string name;
        public int expiresInMs;
    }

    /// <summary>S → C, op 46. confirmInMs is -1 when the server omits it (not both locked).</summary>
    [Serializable]
    public class TradeStateMsg
    {
        public string tradeId;
        public string withId;
        public string withName;
        public TradeOfferView you;
        public TradeOfferView them;
        public bool youLocked;
        public bool themLocked;
        public bool youConfirmed;
        public bool themConfirmed;
        public int confirmInMs = -1;
        /// <summary>Set only when our TRADE_SET / TRADE_LOCK was refused: BAD_REQUEST, TOO_MANY, NOT_OWNED, NOT_ENOUGH.</summary>
        public string reason;
    }

    [Serializable]
    public class TradeGave
    {
        public string[] items;
        public ItemStack[] stacks;
        public int coin;
    }

    [Serializable]
    public class TradeBookResult : FishBookMsg
    {
        public string instanceId;
    }

    /// <summary>S → C, op 47. result: done, cancelled, declined, expired, failed. got, gave and book only when done.</summary>
    [Serializable]
    public class TradeEndMsg
    {
        public string tradeId;
        public string result;
        public string reason;
        /// <summary>failed / BAG_FULL: which side.</summary>
        public string userId;
        public TradeOfferView got;
        public TradeGave gave;
        public TradeBookResult[] book;
    }

    // --- Faz 5: pet stalls (docs/protokol.md, Pazar) ---

    [Serializable]
    public class StallOpenItem
    {
        public string instanceId;
        public int price;
    }

    /// <summary>price is per unit.</summary>
    [Serializable]
    public class StallOpenStack
    {
        public string defId;
        public int count;
        public int price;
    }

    /// <summary>C → S, op 50.</summary>
    [Serializable]
    public class StallOpenMsg
    {
        public string title;
        public StallOpenItem[] items;
        public StallOpenStack[] stacks;
    }

    /// <summary>C → S, op 52 (view) and op 53 (buy). Buy: instanceId for a Float item, or defId + count for a stack; leave the other empty / 0.</summary>
    [Serializable]
    public class StallBuyMsg
    {
        public string userId;
        public string instanceId;
        public string defId;
        public int count;
    }

    /// <summary>tier is empty for stacks; price is per unit for stacks.</summary>
    [Serializable]
    public class StallEntry
    {
        public string defId;
        public string tier;
        public int count;
        public int price;
    }

    [Serializable]
    public class StallView
    {
        public string userId;
        public string name;
        public int spot;
        public float x;
        public float y;
        public string title;
        public StallEntry[] top;
        public int total;
        public long expiresInMs;
    }

    /// <summary>S → C, op 55. full: the list is complete, clear first.</summary>
    [Serializable]
    public class StallsMsg
    {
        public bool full;
        public StallView[] stalls;
        public string[] removed;
    }

    [Serializable]
    public class StallListItem
    {
        public ItemInstance item;
        public int price;
    }

    /// <summary>S → C, op 54.</summary>
    [Serializable]
    public class StallListMsg
    {
        public string userId;
        public string name;
        public string title;
        public StallListItem[] items;
        public StallOpenStack[] stacks;
        public long expiresInMs;
    }

    [Serializable]
    public class StallReturned
    {
        public ItemInstance[] items;
        public ItemStack[] stacks;
    }

    /// <summary>S → C, op 56. action: open, recall, view, buy. Absent parts come as defaults: item.instanceId, defId and book.page are empty when absent.</summary>
    [Serializable]
    public class StallResultMsg
    {
        public string action;
        public bool ok;
        public string reason;
        public int spot;
        public StallReturned returned;
        public ItemInstance item;
        public string defId;
        public int count;
        public int paid;
        public int coin;
        public FishBookMsg book;
    }

    // --- Account deletion RPCs (docs/protokol.md, Hesap silme RPC'leri) ---

    /// <summary>account_delete_request: name must be the account's username exactly.</summary>
    [Serializable]
    public class AccountDeleteRequest
    {
        public string name;
    }

    /// <summary>Answer of account_delete_request (runAt) and account_delete_status (pending, runAt; runAt 0 = none).</summary>
    [Serializable]
    public class AccountDeleteStatus
    {
        public bool pending;
        public long runAt;
    }

    // --- Whisper and reports (docs/protokol.md, Fısıltı) ---

    /// <summary>Nakama notification code of a whisper (subject "whisper", content WhisperNotice).</summary>
    public static class NotifyCode
    {
        public const int LoginLinked = 101;
        public const int LoginUnlinked = 102;
        public const int StallSold = 103;
        public const int DeletionCancelled = 104;
        public const int Whisper = 110;
    }

    /// <summary>whisper_send. Set userId or username (leave the other empty). context "stall" when written from a pet stall.</summary>
    [Serializable]
    public class WhisperSendRequest
    {
        public string userId;
        public string username;
        public string text;
        public string context;
    }

    /// <summary>Answer of whisper_send. text is what the receiver got (personal info masked); show it in your own window.</summary>
    [Serializable]
    public class WhisperSendResponse
    {
        public bool ok;
        public string to;
        public string toName;
        public string text;
        public bool masked;
    }

    /// <summary>Content of a whisper notification (code 110).</summary>
    [Serializable]
    public class WhisperNotice
    {
        public string from;
        public string fromName;
        public string text;
        public string context;
        public long at;
    }

    /// <summary>whisper_settings request and answer. Send {} to only read.</summary>
    [Serializable]
    public class WhisperSettings
    {
        public bool pmOff;
    }

    /// <summary>report_player. reason: spam, abuse, scam, personal_info, cheating, other.</summary>
    [Serializable]
    public class ReportPlayerRequest
    {
        public string userId;
        public string reason;
        public string note;
        public string text;
    }

    // --- Faz 6: daily quests (docs/protokol.md, Günlük görev) ---

    [Serializable]
    public class QuestProgress
    {
        public string id;
        public string @event;
        public int progress;
        public int target;
    }

    /// <summary>S → C, op 57.</summary>
    [Serializable]
    public class QuestStateMsg
    {
        public int day;
        public QuestProgress[] quests;
        public bool complete;
        public bool claimed;
        public int streak;
        public int chestDay;
        public long resetInMs;
    }

    /// <summary>kind: coin, dust or stack (defId set for stack).</summary>
    [Serializable]
    public class QuestReward
    {
        public string kind;
        public string defId;
        public int count;
    }

    /// <summary>S → C, op 59. reason: NOT_DONE, ALREADY_CLAIMED, BAG_FULL, ERROR. coin and dust are the balances after the reward.</summary>
    [Serializable]
    public class QuestClaimResultMsg
    {
        public bool ok;
        public string reason;
        public int streak;
        public int chestDay;
        public QuestReward[] rewards;
        public int coin;
        public int dust;
    }

    [Serializable]
    public class FriendStatus
    {
        public string userId;
        public string username;
        public bool online;
        /// <summary>Empty when not in a world server.</summary>
        public string serverName;
        public string matchId;
        public float x;
        public float y;
    }

    /// <summary>friends_status RPC: mutual friends only.</summary>
    [Serializable]
    public class FriendsStatusResponse
    {
        public FriendStatus[] friends;
    }

    /// <summary>get_inventory RPC.</summary>
    [Serializable]
    public class InventoryResponse
    {
        public int energy;
        public int energyMax;
        public int slotsUsed;
        public int slotsMax;
        public ItemInstance[] items;
        public ItemStack[] stacks;
        /// <summary>Faz 4.</summary>
        public long coin;
        public long dust;
        public RodView rod;
    }

    // --- Faz 4: economy, craft, rod and bait, stash (docs/protokol.md) ---

    public static class Tiers
    {
        public const string Common = "common";
        public const string Rare = "rare";
        public const string Epic = "epic";
        public const string Legendary = "legendary";
        public const string Mythic = "mythic";
        public static readonly string[] All = { Common, Rare, Epic, Legendary, Mythic };
        public static int Rank(string tier) => Array.IndexOf(All, tier);
    }

    /// <summary>Rod durability; max 0 means the field was absent.</summary>
    [Serializable]
    public class RodView
    {
        public int level;
        public int durability;
        public int max;
    }

    /// <summary>C → S, ops 22, 23 (SELL, SALVAGE) and 32, 33 (STASH_PUT, STASH_TAKE).</summary>
    [Serializable]
    public class ItemsAndStacksMsg
    {
        public string[] items;
        public ItemStack[] stacks;
    }

    /// <summary>S → C, op 24. items are instance ids that left the bag.</summary>
    [Serializable]
    public class EconomyResultMsg
    {
        public string action;
        public bool ok;
        public string reason;
        public long coin;
        public long dust;
        public long gained;
        public string[] items;
        public ItemStack[] stacks;
    }

    /// <summary>C → S, op 25: three copies of the same item.</summary>
    [Serializable]
    public class MergeMsg
    {
        public string[] items;
    }

    /// <summary>C → S, op 26.</summary>
    [Serializable]
    public class CraftMsg
    {
        public string recipeId;
        public string[] items;
    }

    /// <summary>S → C, op 27. item has an empty instanceId for stack results; stack has an empty defId for item results.</summary>
    [Serializable]
    public class CraftResultMsg
    {
        public string action;
        public bool ok;
        public string reason;
        public long dust;
        public ItemInstance item;
        public ItemStack stack;
        public FishBookMsg book;
        public string[] items;
        public ItemStack[] stacks;
    }

    /// <summary>C → S, op 29.</summary>
    [Serializable]
    public class BuyBaitMsg
    {
        public string defId;
        public int count;
    }

    /// <summary>S → C, op 30.</summary>
    [Serializable]
    public class ShopResultMsg
    {
        public string action;
        public bool ok;
        public string reason;
        public long coin;
        public long spent;
        public RodView rod;
        public ItemStack stack;
    }

    [Serializable]
    public class StashView
    {
        public int level;
        public int slotsUsed;
        public int slotsMax;
        public ItemInstance[] items;
        public ItemStack[] stacks;
    }

    /// <summary>S → C, op 35. stash.slotsMax is 0 when absent (failures).</summary>
    [Serializable]
    public class StashResultMsg
    {
        public string action;
        public bool ok;
        public string reason;
        public StashView stash;
        /// <summary>Coin left; only sent for expand.</summary>
        public long coin;
        public string[] items;
        public ItemStack[] stacks;
    }

    // get_catalog RPC: display-only prices and recipes (server/src/rules/catalog.ts).

    [Serializable]
    public class CatalogTier
    {
        public string tier;
        public int sell;
        public int dust;
        public int merge;
        public int craft;
    }

    [Serializable]
    public class CatalogCondition
    {
        public string condition;
        public float min;
        public float max;
        /// <summary>double so 0.7 x 5 rounds like the server's JavaScript.</summary>
        public double multiplier;
    }

    /// <summary>sell / dust 0 = the NPC does not buy it / it cannot be salvaged.</summary>
    [Serializable]
    public class CatalogStack
    {
        public string defId;
        public string category;
        public int sell;
        public int dust;
    }

    /// <summary>tier is empty and count above 0 for stack outputs (bait).</summary>
    [Serializable]
    public class RecipeOutput
    {
        public string defId;
        public string tier;
        public int count;
    }

    [Serializable]
    public class CatalogRecipe
    {
        public string id;
        public string grade;
        public RecipeOutput output;
        public int dust;
        public ItemStack[] stacks;
        public ItemStack[] items;
        public float maxFloat;
    }

    [Serializable]
    public class CatalogBait
    {
        public string defId;
        public int price;
    }

    [Serializable]
    public class CatalogRodLevel
    {
        public int level;
        public int max;
        public int fullRepair;
    }

    [Serializable]
    public class CatalogStashTier
    {
        public int slots;
        public int price;
    }

    [Serializable]
    public class CatalogStash
    {
        public float x;
        public float y;
        public float range;
        public int baseSlots;
        public int maxEntries;
        public CatalogStashTier[] tiers;
    }

    [Serializable]
    public class CatalogResponse
    {
        public CatalogTier[] tiers;
        public CatalogCondition[] conditions;
        public CatalogStack[] stacks;
        public int maxEntries;
        public int mergeCount;
        public CatalogRecipe[] recipes;
        public float[] qualitySteps;
        public CatalogBait[] baits;
        public int maxBuy;
        public CatalogRodLevel[] rodLevels;
        public CatalogStash stash;
    }
}
