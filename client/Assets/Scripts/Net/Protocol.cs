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
    }

    public static class ErrorCode
    {
        public const string BadRequest = "BAD_REQUEST";
        public const string ProtocolMismatch = "PROTOCOL_MISMATCH";
        public const string ServerFull = "SERVER_FULL";
        public const string RateLimited = "RATE_LIMITED";
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

    /// <summary>C → S, op 9: where the bobber should land (tiles).</summary>
    [Serializable]
    public class CastMsg
    {
        public float x;
        public float y;
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
    }
}
