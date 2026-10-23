using UnityEditor;
using UnityEditor.Build.Reporting;

public static class CislunarBuild
{
    const string Scene = "Assets/Scenes/CislunarJunior.unity";
    const string Output = "Builds/Windows/CislunarJunior-Orion.exe";

    [MenuItem("Cislunar/Build Windows")]
    public static void BuildWindows()
    {
        CislunarAssetFactory.BuildIfMissing();
        PlayerSettings.SetScriptingBackend(BuildTargetGroup.Standalone, ScriptingImplementation.Mono2x);
        BuildReport report = BuildPipeline.BuildPlayer(new[] { Scene }, Output, BuildTarget.StandaloneWindows64, BuildOptions.None);
        if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            throw new System.Exception("La build de Windows no se completó: " + report.summary.result);
    }
}
