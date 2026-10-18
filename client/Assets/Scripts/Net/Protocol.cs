// Mirrors docs/protokol.md and server/src/protocol.ts. Change the doc first.
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
}
