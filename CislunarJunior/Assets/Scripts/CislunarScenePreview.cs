using UnityEngine;

[ExecuteAlways]
public sealed class CislunarScenePreview : MonoBehaviour
{
    const string PreviewName = "Editor Preview Geometry";

    void OnEnable()
    {
        if (Application.isPlaying) { HidePreview(); return; }
        BuildPreview();
    }

    void BuildPreview()
    {
        if (transform.Find(PreviewName) != null) return;
        Transform root = new GameObject(PreviewName).transform;
        root.SetParent(transform);
        Part(root, "Cabin floor", new Vector3(0, -1.5f, 2), new Vector3(10, .25f, 8), new Color(.03f, .05f, .08f));
        Part(root, "Console", new Vector3(0, -.55f, 2.4f), new Vector3(8.7f, .45f, 1.7f), new Color(.08f, .12f, .18f));
        Monitor(root, "DU1 Route", new Vector3(-2.7f, .35f, 2.3f), new Color(.1f, .55f, .95f));
        Monitor(root, "DU2 Flight", new Vector3(0, .5f, 2.1f), new Color(.15f, .85f, 1f));
        Monitor(root, "DU3 Systems", new Vector3(2.7f, .35f, 2.3f), new Color(.18f, .85f, .48f));
        Part(root, "Window frame top", new Vector3(0, 2.1f, 4.4f), new Vector3(9, .35f, .2f), new Color(.1f, .13f, .18f));
        Part(root, "Window frame left", new Vector3(-4.3f, .8f, 4.4f), new Vector3(.35f, 2.6f, .2f), new Color(.1f, .13f, .18f));
        Part(root, "Window frame right", new Vector3(4.3f, .8f, 4.4f), new Vector3(.35f, 2.6f, .2f), new Color(.1f, .13f, .18f));
    }

    void HidePreview()
    {
        Transform preview = transform.Find(PreviewName);
        if (preview != null) preview.gameObject.SetActive(false);
    }

    static void Monitor(Transform root, string label, Vector3 position, Color accent)
    {
        Part(root, label + " bezel", position, new Vector3(2.2f, 1.35f, .18f), new Color(.01f, .015f, .025f));
        Part(root, label + " screen", position + new Vector3(0, 0, -.1f), new Vector3(2f, 1.14f, .03f), accent * .18f);
    }

    static void Part(Transform parent, string label, Vector3 position, Vector3 scale, Color color)
    {
        GameObject part = GameObject.CreatePrimitive(PrimitiveType.Cube);
        part.name = label;
        part.transform.SetParent(parent);
        part.transform.position = position;
        part.transform.localScale = scale;
        part.GetComponent<Renderer>().sharedMaterial = new Material(Shader.Find("Standard")) { color = color };
    }
}
