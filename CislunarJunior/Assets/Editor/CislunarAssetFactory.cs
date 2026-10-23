using UnityEditor;
using UnityEngine;

[InitializeOnLoad]
public static class CislunarAssetFactory
{
    const string Root = "Assets/Art";

    static CislunarAssetFactory()
    {
        EditorApplication.delayCall += BuildIfMissing;
    }

    [MenuItem("Cislunar/Crear assets técnicos")]
    public static void BuildIfMissing()
    {
        EnsureFolder("Assets", "Art");
        EnsureFolder(Root, "Materials");
        EnsureFolder(Root, "Prefabs");
        Material cockpit = Material("Cockpit", new Color(.045f, .07f, .11f));
        Material metal = Material("Metal", new Color(.42f, .46f, .52f));
        Material route = Material("ScreenRoute", new Color(.03f, .35f, .65f));
        Material flight = Material("ScreenFlight", new Color(.04f, .6f, .75f));
        Material systems = Material("ScreenSystems", new Color(.04f, .55f, .28f));
        Material earth = Material("Earth", new Color(.08f, .35f, .8f));
        Material moon = Material("Moon", new Color(.63f, .64f, .6f));
        Material mars = Material("Mars", new Color(.72f, .2f, .08f));

        Prefab("CabinConsole", () => CabinConsole(cockpit, route, flight, systems));
        Prefab("LaunchVehicle", () => Rocket(metal, cockpit));
        Prefab("LaunchPad", () => Pad(cockpit, metal));
        Prefab("Earth", () => Planet("Earth", earth, 1.2f));
        Prefab("Moon", () => Planet("Moon", moon, .65f));
        Prefab("Mars", () => Planet("Mars", mars, 1f));
        AssetDatabase.SaveAssets();
    }

    static Material Material(string name, Color color)
    {
        string path = Root + "/Materials/" + name + ".mat";
        Material material = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (material != null) return material;
        material = new Material(Shader.Find("Standard")) { color = color };
        AssetDatabase.CreateAsset(material, path);
        return material;
    }

    static void Prefab(string name, System.Func<GameObject> create)
    {
        string path = Root + "/Prefabs/" + name + ".prefab";
        if (AssetDatabase.LoadAssetAtPath<GameObject>(path) != null) return;
        GameObject root = create();
        PrefabUtility.SaveAsPrefabAsset(root, path);
        Object.DestroyImmediate(root);
    }

    static GameObject CabinConsole(Material shell, Material route, Material flight, Material systems)
    {
        GameObject root = new GameObject("CabinConsole");
        Part(root.transform, "Console", Vector3.zero, new Vector3(8.5f, .45f, 1.8f), shell);
        Monitor(root.transform, "DU1 Route", new Vector3(-2.7f, .65f, 0), route);
        Monitor(root.transform, "DU2 Flight", new Vector3(0, .8f, -.15f), flight);
        Monitor(root.transform, "DU3 Systems", new Vector3(2.7f, .65f, 0), systems);
        return root;
    }

    static GameObject Rocket(Material metal, Material dark)
    {
        GameObject root = new GameObject("LaunchVehicle");
        Part(root.transform, "Core", Vector3.zero, new Vector3(1.1f, 7.2f, 1.1f), metal);
        Part(root.transform, "CrewModule", new Vector3(0, 4f, 0), new Vector3(.82f, .8f, .82f), metal);
        Part(root.transform, "Engine", new Vector3(0, -3.8f, 0), new Vector3(1.3f, .5f, 1.3f), dark);
        return root;
    }

    static GameObject Pad(Material dark, Material metal)
    {
        GameObject root = new GameObject("LaunchPad");
        Part(root.transform, "Platform", Vector3.zero, new Vector3(10, .4f, 10), dark);
        Part(root.transform, "Tower", new Vector3(-4.8f, 4f, 0), new Vector3(.55f, 8f, .9f), metal);
        Part(root.transform, "Arm", new Vector3(-3.2f, 5.6f, 0), new Vector3(2.8f, .3f, .5f), metal);
        return root;
    }

    static GameObject Planet(string name, Material material, float scale)
    {
        GameObject root = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        root.name = name; root.transform.localScale = Vector3.one * scale;
        root.GetComponent<Renderer>().sharedMaterial = material;
        return root;
    }

    static void Monitor(Transform root, string name, Vector3 position, Material screen)
    {
        Part(root, name + " Bezel", position, new Vector3(2.25f, 1.4f, .18f), Material("Bezel", new Color(.008f, .012f, .02f)));
        Part(root, name + " Screen", position + new Vector3(0, 0, -.1f), new Vector3(2.04f, 1.18f, .03f), screen);
    }

    static void Part(Transform root, string name, Vector3 position, Vector3 scale, Material material)
    {
        GameObject part = GameObject.CreatePrimitive(PrimitiveType.Cube);
        part.name = name; part.transform.SetParent(root); part.transform.localPosition = position; part.transform.localScale = scale;
        Renderer renderer = part.GetComponent<Renderer>();
        renderer.sharedMaterial = material;
        renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        renderer.receiveShadows = false;
    }

    static void EnsureFolder(string parent, string child)
    {
        string path = parent + "/" + child;
        if (!AssetDatabase.IsValidFolder(path)) AssetDatabase.CreateFolder(parent, child);
    }
}
