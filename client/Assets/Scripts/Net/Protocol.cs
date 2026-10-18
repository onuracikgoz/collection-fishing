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
    }
}
