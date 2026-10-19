using System.IO;
using System.Linq;
using CollectionGame.Fishing;
using CollectionGame.Net;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace CollectionGame.EditorTools
{
    /// <summary>
    /// Command-line helpers (editor must be closed on this project, or run on a copy):
    ///   Unity -batchmode -projectPath client -executeMethod CollectionGame.EditorTools.BuildTools.BuildMac -quit -logFile -
    ///   Unity -batchmode -projectPath client -executeMethod CollectionGame.EditorTools.BuildTools.CheckReelReference -quit -logFile -
    /// Both are also in the CollectionGame menu.
    /// </summary>
    public static class BuildTools
    {
        public const string MacBuildPath = "Builds/macOS/CollectionGame.app";
        const string ReelFixture = "../server/test/fixtures/reel-reference.json";

        [MenuItem("CollectionGame/Build macOS")]
        public static void BuildMac()
        {
            ArtCatalogBuilder.Refresh();
            var scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = MacBuildPath,
                target = BuildTarget.StandaloneOSX,
                options = BuildOptions.None,
            });
            var ok = report.summary.result == BuildResult.Succeeded;
            Debug.Log($"[Build] {report.summary.result}: {MacBuildPath}, {report.summary.totalErrors} errors");
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }

        public const string WebBuildPath = "Builds/Web";

        /// <summary>
        /// WebGL build into Builds/Web. Gzip with the decompression fallback so any
        /// static file server works (no special Content-Encoding headers needed).
        /// </summary>
        [MenuItem("CollectionGame/Build Web")]
        public static void BuildWeb()
        {
            ArtCatalogBuilder.Refresh();
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;
            var scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = WebBuildPath,
                target = BuildTarget.WebGL,
                options = BuildOptions.None,
            });
            var ok = report.summary.result == BuildResult.Succeeded;
            Debug.Log($"[Build] {report.summary.result}: {WebBuildPath}, {report.summary.totalErrors} errors");
            if (Application.isBatchMode) EditorApplication.Exit(ok ? 0 : 1);
        }

        [System.Serializable]
        class Fixture
        {
            public Case[] cases;
        }

        [System.Serializable]
        class Case
        {
            public string tier;
            public long seed;
            public ReelParams @params;
            public int[] inputs;
            public Expected expected;
        }

        [System.Serializable]
        class Expected
        {
            public bool caught;
            public int steps;
        }

        /// <summary>The C# reel model must give the server's result for every reference case.</summary>
        [MenuItem("CollectionGame/Check Reel Reference")]
        public static void CheckReelReference()
        {
            var fixture = JsonUtility.FromJson<Fixture>(File.ReadAllText(ReelFixture));
            var bad = 0;
            foreach (var c in fixture.cases)
            {
                var (caught, steps) = ReelModel.Simulate((uint)c.seed, c.@params, c.inputs);
                if (caught == c.expected.caught && steps == c.expected.steps) continue;
                bad++;
                Debug.LogError($"[Reel] {c.tier} seed {c.seed}: got {caught}/{steps}, want {c.expected.caught}/{c.expected.steps}");
            }
            Debug.Log($"[Reel] {fixture.cases.Length - bad}/{fixture.cases.Length} reference cases match");
            if (Application.isBatchMode) EditorApplication.Exit(bad == 0 ? 0 : 1);
        }
    }
}
