using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

[InitializeOnLoad]
public static class CislunarProjectSetup
{
    const string MainScene = "Assets/Scenes/CislunarJunior.unity";

    static CislunarProjectSetup()
    {
        if (!Application.isBatchMode) EditorApplication.delayCall += OpenInitialScene;
    }

    static void OpenInitialScene()
    {
        if (EditorApplication.isPlayingOrWillChangePlaymode) return;
        Scene active = SceneManager.GetActiveScene();
        if (string.IsNullOrEmpty(active.path)) EditorSceneManager.OpenScene(MainScene);
        CislunarAssetFactory.BuildIfMissing();
    }
}
