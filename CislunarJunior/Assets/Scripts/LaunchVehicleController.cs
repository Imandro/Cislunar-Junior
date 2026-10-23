using UnityEngine;
using System.Collections.Generic;

/// Drives the didactic SLS/Orion stack without duplicating MissionModel physics.
public sealed class LaunchVehicleController : MonoBehaviour
{
    // Metric world: one Unity unit represents one metre near the launch pad.
    public const float WorldMetersPerUnit = 1f;
    public LaunchVehicleState State { get; private set; }
    public Transform RocketRoot { get; private set; }

    Transform sls, orion, lander, srbLeft, srbRight, core, separated;
    Transform officialSlsVisual, separationRig;
    Transform serviceModule, solarLeft, solarRight, tower, plume, plumeInner, plumeHalo, plumeLeft, plumeRight, smoke, smokeAnchor, fallbackStack, fallbackOrion, fallbackSolarLeft, fallbackSolarRight, icps;
    Transform[] smokePuffs;
    Light exhaustLight;
    readonly List<Mesh> officialSplitMeshes = new List<Mesh>();
    bool monolithicSls, importedSlsVisual, officialAssetValidated, slsContainsOrion;
    bool officialSeparationGeometry;
    float stageSwapProgress;
    Vector3 padPosition;
    Vector3 towerPadPosition;
    Vector3 srbLeftPad, srbRightPad, corePad;
    Vector3 rocketVelocity;
    float stateTime;
    float coreSeparationElapsed;
    bool coreWasSeparated;

    public Transform SRBLeft => srbLeft;
    public Transform SRBRight => srbRight;
    public Transform CoreStage => core;
    public Transform ICPS => icps;
    public bool UsingAnimatedFallback => monolithicSls;
    public bool UsingOfficialSeparatedGeometry => officialSeparationGeometry;
    public Bounds VisualBounds { get; private set; }
    public float VisualRadius => Mathf.Max(VisualBounds.extents.magnitude, 4f);

    public void Configure(Transform rocketRoot, GameObject slsVisual, GameObject orionVisual, GameObject landerVisual, Transform separatedStage)
    {
        RocketRoot = rocketRoot;
        sls = slsVisual != null ? slsVisual.transform : null;
        officialSlsVisual = sls;
        orion = orionVisual != null ? orionVisual.transform : null;
        lander = landerVisual != null ? landerVisual.transform : null;
        separated = separatedStage;
        tower = rocketRoot.parent == null ? null : rocketRoot.parent.Find("Mobile Launch Tower");
        towerPadPosition = tower == null ? Vector3.zero : tower.localPosition;
        padPosition = rocketRoot.position;
        srbLeft = Find(sls, "SRB_Left"); srbRight = Find(sls, "SRB_Right"); core = Find(sls, "CoreStage");
        // NASA SLS import can be one mesh. Keep it for the launch silhouette,
        // then switch to the local hierarchy when stages must separate.
        officialAssetValidated = sls != null && HasUsableImportedBounds(sls);
        importedSlsVisual = officialAssetValidated;
        monolithicSls = srbLeft == null || srbRight == null || core == null || !HasUsableSlsBounds(sls);
        if (monolithicSls)
        {
            fallbackStack = officialAssetValidated ? BuildOfficialSeparationRig(sls) : null;
            officialSeparationGeometry = fallbackStack != null;
            if (fallbackStack == null && !officialAssetValidated) fallbackStack = BuildFallbackStack();
            if (officialAssetValidated && fallbackStack == null)
                Debug.LogWarning("Official SLS mesh could not be split into animation modules; no substitute rocket will be shown.");
            srbLeft = Find(fallbackStack, "SRB_Left"); srbRight = Find(fallbackStack, "SRB_Right"); core = Find(fallbackStack, "CoreStage");
            icps = Find(fallbackStack, "ICPS");
            fallbackOrion = Find(fallbackStack, "Orion");
            fallbackSolarLeft = Find(fallbackOrion, "SolarWing_Left"); fallbackSolarRight = Find(fallbackOrion, "SolarWing_Right");
        }
        else icps = Find(sls, "ICPS");
        separationRig = fallbackStack;
        if (!officialSeparationGeometry) ApplyModuleColors(fallbackStack);
        slsContainsOrion = HasNamedPart(sls, "orion");
        srbLeftPad = srbLeft == null ? Vector3.zero : srbLeft.localPosition;
        srbRightPad = srbRight == null ? Vector3.zero : srbRight.localPosition;
        corePad = core == null ? Vector3.zero : core.localPosition;
        rocketVelocity = Vector3.zero;
        serviceModule = Find(orion, "ServiceModule"); solarLeft = Find(orion, "SolarWing_Left"); solarRight = Find(orion, "SolarWing_Right");
        ApplyModuleColors(sls);
        ApplyModuleColors(orion);
        ApplyModuleColors(separated);
        EnsureEffects();
        // Runtime fallback/effects are created after Exterior is layered. Keep them
        // on ExteriorLayer or the cabin camera would draw the launch vehicle directly.
        int exteriorLayer = RocketRoot.gameObject.layer;
        SetLayerRecursively(RocketRoot.gameObject, exteriorLayer);
        if (smokeAnchor != null) SetLayerRecursively(smokeAnchor.gameObject, exteriorLayer);
        State = LaunchVehicleState.Pad;
        stageSwapProgress = 0f;
        coreSeparationElapsed = 0f;
        coreWasSeparated = false;
    }

    public void Tick(float deltaTime, MissionModel mission)
    {
        if (RocketRoot == null || mission == null) return;
        LaunchVehicleState next = mission.LaunchState;
        if (next != State) { State = next; stateTime = 0; }
        else stateTime += deltaTime;

        float climb = Mathf.Max(0f, mission.AltitudeKm * 1000f / WorldMetersPerUnit);
        if (mission.Phase == FlightPhase.Pad) climb = 0;
        // Keep first liftoff frames visible while telemetry is still near zero.
        if (mission.Phase >= FlightPhase.Launch && mission.Phase < FlightPhase.Transfer)
            climb = Mathf.Max(climb, Mathf.Min(1f, stateTime * 8f));
        float pitch = Mathf.Clamp((mission.Phase >= FlightPhase.Ascent ? Mathf.Lerp(0, 8f, Mathf.InverseLerp(0, 180, mission.AltitudeKm)) : 0) + mission.Pitch * .08f, -12f, 12f);
        float lateral = mission.Phase >= FlightPhase.Ascent ? Mathf.Sin(pitch * Mathf.Deg2Rad) * climb * .35f : 0f;
        Vector3 targetPosition = padPosition + new Vector3(lateral, climb, 0);
        RocketRoot.position = Vector3.SmoothDamp(RocketRoot.position, targetPosition, ref rocketVelocity, .06f, Mathf.Infinity, Mathf.Max(deltaTime, .001f));
        RocketRoot.rotation = Quaternion.Slerp(RocketRoot.rotation, Quaternion.Euler(0, 0, -pitch), Mathf.Clamp01(deltaTime * 8f));

        // Monolithic imports are kept as source; use aligned stack only through ICPS burn.
        bool launchStackVisible = State <= LaunchVehicleState.ICPSBurn;
        bool splitFallback = monolithicSls && launchStackVisible;
        bool orbital = mission.Phase >= FlightPhase.ParkingOrbit && mission.Phase < FlightPhase.Descent;
        bool landing = mission.Phase == FlightPhase.Descent || mission.Phase == FlightPhase.Surface;
        bool useImportedLaunch = importedSlsVisual && mission.LaunchState < LaunchVehicleState.SRBSeparation;
        stageSwapProgress = Mathf.MoveTowards(stageSwapProgress, useImportedLaunch ? 0f : 1f, Mathf.Max(deltaTime, .001f) * 6f);
        SetActive(sls, launchStackVisible && useImportedLaunch);
        // Keep local SRBs around the imported NASA core during launch. The
        // source FBX is a single mesh and does not expose booster transforms.
        SetActive(fallbackStack, splitFallback || (!useImportedLaunch && launchStackVisible));
        // The fallback Orion belongs to the stack until transfer. Hide it before
        // the standalone capsule appears so the vehicle is never duplicated.
        SetActive(fallbackOrion, splitFallback && !useImportedLaunch && mission.Phase < FlightPhase.Transfer);
        bool spentBoostersVisible = State == LaunchVehicleState.SRBSeparation && stateTime < 4f;
        if (srbLeft != null) srbLeft.gameObject.SetActive(!importedSlsVisual ? !mission.SRBsSeparated || spentBoostersVisible : spentBoostersVisible);
        if (srbRight != null) srbRight.gameObject.SetActive(!importedSlsVisual ? !mission.SRBsSeparated || spentBoostersVisible : spentBoostersVisible);
        bool standaloneOrion = !launchStackVisible || (!slsContainsOrion && !monolithicSls);
        SetActive(orion, standaloneOrion && (mission.Phase >= FlightPhase.Transfer || orbital || mission.Phase == FlightPhase.Arrival || (mission.Phase >= FlightPhase.Return && !landing) || mission.Phase <= FlightPhase.Ascent));
        SetActive(lander, landing);
        if (tower != null)
        {
            float towerClearance = mission.Phase >= FlightPhase.Launch ? EaseOut(Mathf.Clamp01(stateTime * .7f + .35f)) : 0f;
            tower.localPosition = Vector3.Lerp(towerPadPosition, towerPadPosition + new Vector3(-2.2f, 0, 0), towerClearance);
        }

        float deploy = orbital || mission.Phase >= FlightPhase.Arrival ? 1f : 0f;
        if (solarLeft != null) solarLeft.localScale = Vector3.Lerp(Vector3.zero, Vector3.one, deploy);
        if (solarRight != null) solarRight.localScale = Vector3.Lerp(Vector3.zero, Vector3.one, deploy);
        if (fallbackSolarLeft != null) fallbackSolarLeft.localScale = Vector3.Lerp(Vector3.zero, Vector3.one, deploy);
        if (fallbackSolarRight != null) fallbackSolarRight.localScale = Vector3.Lerp(Vector3.zero, Vector3.one, deploy);
        if (serviceModule != null) serviceModule.gameObject.SetActive(mission.Phase < FlightPhase.Reentry);

        bool srbsSeparated = mission.SRBsSeparated;
        bool coreSeparated = mission.CoreSeparated;
        if (coreSeparated && !coreWasSeparated) coreSeparationElapsed = 0f;
        if (coreSeparated) coreSeparationElapsed += deltaTime;
        coreWasSeparated = coreSeparated;
        bool separatedNow = coreSeparated;
        if (separated != null && !officialSeparationGeometry)
        {
            separated.gameObject.SetActive(separatedNow && mission.Phase < FlightPhase.Transfer);
            if (separatedNow)
            {
                float t = Mathf.Clamp01(stateTime * .22f + .2f);
                separated.position = RocketRoot.position + new Vector3(-1.5f - t * 2.4f, -2.4f - t * 1.1f, 0);
                separated.rotation = Quaternion.Euler(0, 0, -18f * t);
            }
        }
        float srbT = srbsSeparated ? EaseOut(Mathf.Clamp01(stateTime * .55f + .1f)) : 0f;
        if (srbLeft != null) srbLeft.localPosition = srbsSeparated ? Vector3.Lerp(srbLeftPad, srbLeftPad + new Vector3(-1.8f - srbT * 1.5f, -1.05f - srbT * .5f, 0), srbT) : srbLeftPad;
        if (srbRight != null) srbRight.localPosition = srbsSeparated ? Vector3.Lerp(srbRightPad, srbRightPad + new Vector3(1.8f + srbT * 1.5f, -1.05f - srbT * .5f, 0), srbT) : srbRightPad;
        if (core != null)
        {
            bool splitStageVisible = !importedSlsVisual || State >= LaunchVehicleState.SRBSeparation;
            if (!coreSeparated)
            {
                core.localPosition = corePad;
                core.localRotation = Quaternion.identity;
                core.gameObject.SetActive(splitStageVisible);
            }
            else if (mission.LaunchState == LaunchVehicleState.CoreSeparation && splitStageVisible)
            {
                float separation = EaseOut(Mathf.Clamp01(coreSeparationElapsed / 3f));
                core.localPosition = corePad + new Vector3(-4f * separation, -8f * separation, 4.5f * separation);
                core.localRotation = Quaternion.Euler(0f, 20f * separation, -18f * separation);
                core.gameObject.SetActive(true);
            }
            else core.gameObject.SetActive(false);
        }
        if (icps != null) icps.gameObject.SetActive(!importedSlsVisual || State >= LaunchVehicleState.SRBSeparation);

        bool burn = mission.LaunchState == LaunchVehicleState.Ignition || mission.LaunchState == LaunchVehicleState.Liftoff || mission.LaunchState == LaunchVehicleState.Ascent || mission.LaunchState == LaunchVehicleState.SRBSeparation || mission.LaunchState == LaunchVehicleState.ICPSBurn;
        bool upperStageBurn = mission.LaunchState == LaunchVehicleState.ICPSBurn;
        float burnFactor = Mathf.Clamp01(mission.Throttle) * (mission.LaunchState == LaunchVehicleState.Ignition ? Mathf.Clamp01(stateTime * 2.5f) : 1f);
        SetActive(plume, burn); SetActive(plumeInner, burn); SetActive(plumeHalo, burn); SetActive(plumeLeft, burn); SetActive(plumeRight, burn);
        bool smokeVisible = burn && mission.AltitudeKm < 28f;
        SetActive(smokeAnchor, smokeVisible);
        SetActive(smoke, smokeVisible);
        if (smokePuffs != null)
        {
            float smokeFade = Mathf.Clamp01(1f - mission.AltitudeKm / 28f);
            for (int i = 0; i < smokePuffs.Length; i++)
            {
                Transform puff = smokePuffs[i];
                SetActive(puff, burn && smokeFade > .02f);
                if (puff == null) continue;
                float drift = stateTime * (.35f + i * .07f);
                puff.localPosition = new Vector3(Mathf.Sin(drift + i) * (.42f + i * .15f), .08f + i * .12f + drift * .08f, Mathf.Cos(drift * .8f + i) * (.22f + i * .04f));
                float scale = (.45f + i * .1f) * (1f + mission.Throttle * .25f) * (1f + smokeFade * .2f);
                puff.localScale = Vector3.one * scale;
            }
        }
        if (plume != null)
        {
            float flameHalfHeight = (.7f + burnFactor * 1.9f) * (upperStageBurn ? .72f : 1f);
            float width = upperStageBurn ? .2f + burnFactor * .1f : .32f + burnFactor * .18f;
            plume.localScale = new Vector3(width, flameHalfHeight, width);
            float nozzleY = (upperStageBurn ? 3.15f : -4.12f) - flameHalfHeight * .5f;
            plume.localPosition = new Vector3(0, nozzleY, upperStageBurn ? 0f : -.22f);
            if (plumeInner != null) { plumeInner.localScale = new Vector3(width * .56f, flameHalfHeight * .8f, width * .56f); plumeInner.localPosition = plume.localPosition + Vector3.forward * -.08f; }
            if (plumeHalo != null) { plumeHalo.localScale = new Vector3(width * 1.18f, flameHalfHeight * 1.08f, width * 1.18f); plumeHalo.localPosition = plume.localPosition + Vector3.forward * .08f; }
            if (plumeLeft != null) { plumeLeft.localScale = new Vector3(width * .52f, flameHalfHeight * .72f, width * .52f); plumeLeft.localPosition = new Vector3(-.42f, nozzleY, upperStageBurn ? 0f : -.22f); }
            if (plumeRight != null) { plumeRight.localScale = new Vector3(width * .52f, flameHalfHeight * .72f, width * .52f); plumeRight.localPosition = new Vector3(.42f, nozzleY, upperStageBurn ? 0f : -.22f); }
        }
        if (smoke != null) smoke.localScale = Vector3.one * (.72f + burnFactor * .35f) * (1f + Mathf.Clamp01(1f - mission.AltitudeKm / 28f) * .2f);
        if (exhaustLight != null) { exhaustLight.enabled = burn; exhaustLight.intensity = burnFactor * 2.2f; exhaustLight.range = upperStageBurn ? 5f : 9f; }
        RecalculateVisualBounds();
    }

    public Vector3 CameraTarget => RocketRoot == null ? Vector3.zero : VisualBounds.center;

    static Transform Find(Transform parent, string name)
    {
        if (parent == null) return null;
        foreach (Transform child in parent)
        {
            if (child.name == name) return child;
            Transform match = Find(child, name);
            if (match != null) return match;
        }
        return null;
    }
    static bool HasNamedPart(Transform root, string token)
    {
        if (root == null) return false;
        foreach (Transform child in root.GetComponentsInChildren<Transform>(true)) if (child.name.ToLowerInvariant().Contains(token)) return true;
        return false;
    }
    static void SetActive(Transform target, bool value) { if (target != null) target.gameObject.SetActive(value); }

    static void SetLayerRecursively(GameObject root, int layer)
    {
        if (root == null) return;
        root.layer = layer;
        foreach (Transform child in root.transform) SetLayerRecursively(child.gameObject, layer);
    }

    static bool HasUsableSlsBounds(Transform root)
    {
        if (root == null) return false;
        Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
        if (renderers.Length < 8) return false;
        Bounds bounds = new Bounds();
        bool found = false;
        foreach (Renderer renderer in renderers)
        {
            Bounds candidate = renderer.bounds;
            if (!IsFinite(candidate.center) || candidate.size.y <= .001f) continue;
            if (!found) { bounds = candidate; found = true; }
            else bounds.Encapsulate(candidate);
        }
        if (!found || bounds.size.y <= .001f) return false;
        float width = Mathf.Max(bounds.size.x, bounds.size.z);
        float ratio = width / bounds.size.y;
        return width > .01f && ratio >= .08f && ratio <= .3f;
    }

    static bool HasUsableImportedBounds(Transform root)
    {
        if (root == null) return false;
        Renderer[] renderers = root.GetComponentsInChildren<Renderer>(true);
        if (renderers.Length == 0) return false;
        Bounds bounds = renderers[0].bounds;
        for (int i = 1; i < renderers.Length; i++) bounds.Encapsulate(renderers[i].bounds);
        float height = bounds.size.y;
        float width = Mathf.Max(bounds.size.x, bounds.size.z);
        return IsFinite(bounds.center) && IsFinite(bounds.size) && height > .01f && width / height < 1.35f;
    }

    static bool IsFinite(Vector3 value) => IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
    static bool IsFinite(float value) => !float.IsNaN(value) && !float.IsInfinity(value);

    static void ApplyModuleColors(Transform root)
    {
        if (root == null) return;
        foreach (Renderer renderer in root.GetComponentsInChildren<Renderer>(true))
        {
            string label = renderer.transform.name.ToLowerInvariant();
            Color color;
            if (label.Contains("white") || label.Contains("aft skirt")) color = new Color(.86f, .87f, .88f);
            else if (label.Contains("orange") || label.Contains("tank") || label.Contains("core")) color = new Color(.82f, .34f, .09f);
            else if (label.Contains("srb") || label.Contains("booster")) color = new Color(.9f, .89f, .84f);
            else if (label.Contains("engine") || label.Contains("nozzle") || label.Contains("skirt")) color = new Color(.1f, .12f, .15f);
            else if (label.Contains("solar") || label.Contains("panel")) color = new Color(.025f, .1f, .28f);
            else if (label.Contains("icps") || label.Contains("service") || label.Contains("metal")) color = new Color(.62f, .65f, .68f);
            else if (label.Contains("orion") || label.Contains("crew") || label.Contains("capsule")) color = new Color(.9f, .91f, .92f);
            else continue;
            renderer.material.color = color;
        }
    }

    Transform BuildOfficialSeparationRig(Transform source)
    {
        var filter = source == null ? null : source.GetComponentInChildren<MeshFilter>(true);
        var sourceRenderer = source == null ? null : source.GetComponentInChildren<MeshRenderer>(true);
        if (filter == null || sourceRenderer == null || filter.sharedMesh == null) return null;

        Mesh sourceMesh = filter.sharedMesh;
        Vector3[] sourceVertices = sourceMesh.vertices;
        if (sourceVertices.Length < 100) return null;
        Matrix4x4 toRocket = RocketRoot.worldToLocalMatrix * filter.transform.localToWorldMatrix;
        Vector3[] vertices = new Vector3[sourceVertices.Length];
        Bounds bounds = new Bounds(toRocket.MultiplyPoint3x4(sourceVertices[0]), Vector3.zero);
        for (int i = 0; i < sourceVertices.Length; i++)
        {
            vertices[i] = toRocket.MultiplyPoint3x4(sourceVertices[i]);
            bounds.Encapsulate(vertices[i]);
        }
        if (bounds.size.y < .01f || !IsFinite(bounds.center) || !IsFinite(bounds.size)) return null;

        float splitHeight = .72f;
        float icpsHeight = .84f;
        // UV seams duplicate vertex indices. Weld identical positions before finding
        // connected shells; triangle-centre distance splits long cables as boosters.
        int[] parent = new int[sourceVertices.Length];
        for (int i = 0; i < parent.Length; i++) parent[i] = i;
        var welded = new Dictionary<Vector3Int, int>();
        for (int i = 0; i < sourceVertices.Length; i++)
        {
            Vector3 p = sourceVertices[i] * 10000000f;
            var key = new Vector3Int(Mathf.RoundToInt(p.x), Mathf.RoundToInt(p.y), Mathf.RoundToInt(p.z));
            if (welded.TryGetValue(key, out int first)) JoinComponent(parent, first, i);
            else welded.Add(key, i);
        }
        for (int submesh = 0; submesh < sourceMesh.subMeshCount; submesh++)
        {
            int[] triangles = sourceMesh.GetTriangles(submesh);
            for (int i = 0; i < triangles.Length; i += 3)
            {
                JoinComponent(parent, triangles[i], triangles[i + 1]);
                JoinComponent(parent, triangles[i], triangles[i + 2]);
            }
        }
        var componentCounts = new Dictionary<int, int>();
        var componentCenters = new Dictionary<int, Vector3>();
        for (int submesh = 0; submesh < sourceMesh.subMeshCount; submesh++)
        {
            int[] triangles = sourceMesh.GetTriangles(submesh);
            for (int i = 0; i < triangles.Length; i += 3)
            {
                int component = FindComponent(parent, triangles[i]);
                Vector3 center = (vertices[triangles[i]] + vertices[triangles[i + 1]] + vertices[triangles[i + 2]]) / 3f;
                componentCounts[component] = componentCounts.TryGetValue(component, out int count) ? count + 1 : 1;
                componentCenters[component] = componentCenters.TryGetValue(component, out Vector3 sum) ? sum + center : center;
            }
        }
        var major = new List<int>(componentCounts.Keys);
        major.Sort((a, b) => componentCounts[b].CompareTo(componentCounts[a]));
        if (major.Count < 3 || componentCounts[major[1]] < 1000 || componentCounts[major[2]] < 1000) return null;
        Vector3 boosterA = componentCenters[major[1]] / componentCounts[major[1]];
        Vector3 boosterB = componentCenters[major[2]] / componentCounts[major[2]];
        bool splitOnX = Mathf.Abs(boosterA.x - boosterB.x) >= Mathf.Abs(boosterA.z - boosterB.z);
        int leftBooster = (splitOnX ? boosterA.x < boosterB.x : boosterA.z < boosterB.z) ? major[1] : major[2];
        int rightBooster = leftBooster == major[1] ? major[2] : major[1];
        var trianglesByPart = new List<int[]>[5, sourceMesh.subMeshCount];
        int[] partTriangleCounts = new int[5];
        for (int part = 0; part < 5; part++)
            for (int submesh = 0; submesh < sourceMesh.subMeshCount; submesh++) trianglesByPart[part, submesh] = new List<int[]>();

        for (int submesh = 0; submesh < sourceMesh.subMeshCount; submesh++)
        {
            int[] triangles = sourceMesh.GetTriangles(submesh);
            for (int i = 0; i < triangles.Length; i += 3)
            {
                Vector3 center = (vertices[triangles[i]] + vertices[triangles[i + 1]] + vertices[triangles[i + 2]]) / 3f;
                float height = Mathf.InverseLerp(bounds.min.y, bounds.max.y, center.y);
                int component = FindComponent(parent, triangles[i]);
                int part;
                if (component == leftBooster) part = 0;
                else if (component == rightBooster) part = 1;
                else if (height >= icpsHeight) part = 4;
                else if (height >= splitHeight) part = 3;
                else part = 2;
                trianglesByPart[part, submesh].Add(new[] { triangles[i], triangles[i + 1], triangles[i + 2] });
                partTriangleCounts[part]++;
            }
        }
        for (int part = 0; part < partTriangleCounts.Length; part++) if (partTriangleCounts[part] < 20) return null;

        Transform rig = new GameObject("Animated SLS separation stack").transform;
        rig.SetParent(RocketRoot, false);
        string[] names = { "SRB_Left", "SRB_Right", "CoreStage", "ICPS", "Orion" };
        for (int part = 0; part < names.Length; part++)
        {
            Mesh splitMesh = BuildOfficialModuleMesh(names[part], sourceMesh, vertices, trianglesByPart, part, toRocket);
            if (splitMesh == null) { Destroy(rig.gameObject); return null; }
            officialSplitMeshes.Add(splitMesh);
            Transform module = new GameObject(names[part]).transform;
            module.SetParent(rig, false);
            module.localPosition = splitMesh.bounds.center;
            Vector3[] moduleVertices = splitMesh.vertices;
            Vector3 pivot = module.localPosition;
            for (int i = 0; i < moduleVertices.Length; i++) moduleVertices[i] -= pivot;
            splitMesh.vertices = moduleVertices;
            splitMesh.RecalculateBounds();
            var meshFilter = module.gameObject.AddComponent<MeshFilter>(); meshFilter.sharedMesh = splitMesh;
            var renderer = module.gameObject.AddComponent<MeshRenderer>(); renderer.sharedMaterials = sourceRenderer.sharedMaterials;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; renderer.receiveShadows = false;
            module.gameObject.layer = RocketRoot.gameObject.layer;
        }
        rig.gameObject.SetActive(false);
        return rig;
    }

    static int FindComponent(int[] parent, int index)
    {
        while (parent[index] != index) { parent[index] = parent[parent[index]]; index = parent[index]; }
        return index;
    }

    static void JoinComponent(int[] parent, int a, int b)
    {
        a = FindComponent(parent, a); b = FindComponent(parent, b);
        if (a != b) parent[b] = a;
    }

    static Mesh BuildOfficialModuleMesh(string name, Mesh source, Vector3[] positions, List<int[]>[,] groupedTriangles, int part, Matrix4x4 toRocket)
    {
        var indices = new Dictionary<int, int>();
        var vertices = new List<Vector3>(); var normals = new List<Vector3>(); var tangents = new List<Vector4>();
        var uv = new List<Vector2>(); var uv2 = new List<Vector2>(); var colors = new List<Color>();
        Vector3[] sourceNormals = source.normals; Vector4[] sourceTangents = source.tangents;
        Matrix4x4 normalToRocket = toRocket.inverse.transpose;
        Vector2[] sourceUv = source.uv; Vector2[] sourceUv2 = source.uv2; Color[] sourceColors = source.colors;
        var bounds = new Bounds(); bool hasBounds = false;
        for (int submesh = 0; submesh < source.subMeshCount; submesh++)
            foreach (int[] triangle in groupedTriangles[part, submesh])
                foreach (int sourceIndex in triangle)
                {
                    if (!indices.TryGetValue(sourceIndex, out int targetIndex))
                    {
                        targetIndex = vertices.Count; indices.Add(sourceIndex, targetIndex);
                        vertices.Add(positions[sourceIndex]);
                        if (sourceNormals.Length == source.vertexCount) normals.Add(normalToRocket.MultiplyVector(sourceNormals[sourceIndex]).normalized);
                        if (sourceTangents.Length == source.vertexCount)
                        {
                            Vector4 tangent = sourceTangents[sourceIndex];
                            Vector3 direction = toRocket.MultiplyVector(new Vector3(tangent.x, tangent.y, tangent.z)).normalized;
                            tangents.Add(new Vector4(direction.x, direction.y, direction.z, tangent.w));
                        }
                        if (sourceUv.Length == source.vertexCount) uv.Add(sourceUv[sourceIndex]);
                        if (sourceUv2.Length == source.vertexCount) uv2.Add(sourceUv2[sourceIndex]);
                        if (sourceColors.Length == source.vertexCount) colors.Add(sourceColors[sourceIndex]);
                        if (!hasBounds) { bounds = new Bounds(positions[sourceIndex], Vector3.zero); hasBounds = true; }
                        else bounds.Encapsulate(positions[sourceIndex]);
                    }
                }
        if (vertices.Count < 60) return null;
        var mesh = new Mesh { name = "Official SLS " + name };
        if (vertices.Count > 65535) mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
        mesh.SetVertices(vertices);
        if (normals.Count == vertices.Count) mesh.SetNormals(normals); else mesh.RecalculateNormals();
        if (tangents.Count == vertices.Count) mesh.SetTangents(tangents);
        if (uv.Count == vertices.Count) mesh.SetUVs(0, uv);
        if (uv2.Count == vertices.Count) mesh.SetUVs(1, uv2);
        if (colors.Count == vertices.Count) mesh.SetColors(colors);
        mesh.subMeshCount = source.subMeshCount;
        for (int submesh = 0; submesh < source.subMeshCount; submesh++)
        {
            var submeshIndices = new List<int>();
            foreach (int[] triangle in groupedTriangles[part, submesh])
                foreach (int sourceIndex in triangle) submeshIndices.Add(indices[sourceIndex]);
            mesh.SetTriangles(submeshIndices, submesh, false);
        }
        mesh.RecalculateBounds();
        mesh.UploadMeshData(false);
        return mesh;
    }

    void OnDestroy()
    {
        foreach (Mesh mesh in officialSplitMeshes)
        {
            if (mesh == null) continue;
            if (Application.isPlaying) Destroy(mesh); else DestroyImmediate(mesh);
        }
        officialSplitMeshes.Clear();
    }

    void RecalculateVisualBounds()
    {
        bool found = false;
        Bounds bounds = new Bounds(RocketRoot == null ? Vector3.zero : RocketRoot.position, Vector3.one);
        Transform[] roots = { RocketRoot, separated };
        foreach (Transform root in roots)
        {
            if (root == null) continue;
            foreach (Renderer renderer in root.GetComponentsInChildren<Renderer>(true))
            {
                if (!renderer.gameObject.activeInHierarchy) continue;
                string name = renderer.name.ToLowerInvariant();
                if (name.Contains("plume") || name.Contains("smoke")) continue;
                if (State >= LaunchVehicleState.SRBSeparation &&
                    ((srbLeft != null && renderer.transform.IsChildOf(srbLeft)) || (srbRight != null && renderer.transform.IsChildOf(srbRight)))) continue;
                if (State >= LaunchVehicleState.CoreSeparation && core != null && renderer.transform.IsChildOf(core)) continue;
                if (!found) { bounds = renderer.bounds; found = true; }
                else bounds.Encapsulate(renderer.bounds);
            }
        }
        VisualBounds = found ? bounds : new Bounds(RocketRoot.position + Vector3.up * 3f, Vector3.one * 8f);
    }

    void EnsureEffects()
    {
        if (RocketRoot == null || plume != null) return;
        plume = Primitive("RS25 plume", PrimitiveType.Sphere, RocketRoot, new Vector3(0, -3.75f, -.22f), new Vector3(.62f, 2.0f, .62f), new Color(1f, .34f, .04f));
        SetEmission(plume, new Color(1f, .18f, .015f) * 1.15f);
        plumeInner = Primitive("RS25 plume inner", PrimitiveType.Sphere, RocketRoot, new Vector3(0, -3.75f, -.3f), new Vector3(.3f, 1.45f, .3f), new Color(.74f, .94f, 1f));
        SetEmission(plumeInner, new Color(.72f, .9f, 1f) * 2.1f);
        plumeHalo = Primitive("RS25 plume halo", PrimitiveType.Sphere, RocketRoot, new Vector3(0, -3.75f, -.14f), new Vector3(.86f, 1.75f, .86f), new Color(1f, .12f, .015f));
        SetEmission(plumeHalo, new Color(1f, .045f, .005f) * .42f);
        plumeLeft = Primitive("RS25 plume left", PrimitiveType.Sphere, RocketRoot, new Vector3(-.42f, -3.75f, -.22f), new Vector3(.48f, 1.65f, .48f), new Color(1f, .3f, .035f));
        SetEmission(plumeLeft, new Color(1f, .12f, .008f) * .95f);
        plumeRight = Primitive("RS25 plume right", PrimitiveType.Sphere, RocketRoot, new Vector3(.42f, -3.75f, -.22f), new Vector3(.48f, 1.65f, .48f), new Color(1f, .3f, .035f));
        SetEmission(plumeRight, new Color(1f, .12f, .008f) * .95f);
        Transform effectsParent = RocketRoot.parent == null ? RocketRoot : RocketRoot.parent;
        smokeAnchor = new GameObject("Launch smoke platform anchor").transform;
        smokeAnchor.SetParent(effectsParent, false);
        smokeAnchor.position = padPosition + new Vector3(0, -4.1f, -.8f);
        smoke = Primitive("Launch smoke", PrimitiveType.Sphere, smokeAnchor, Vector3.zero, new Vector3(1.25f, .16f, 1.25f), new Color(.24f, .25f, .27f));
        SoftenSmoke(smoke, .07f);
        smokePuffs = new Transform[6];
        for (int i = 0; i < smokePuffs.Length; i++)
        {
            smokePuffs[i] = Primitive("Launch smoke puff " + i, PrimitiveType.Sphere, smokeAnchor, Vector3.zero, Vector3.one * (.42f + i * .035f), new Color(.24f + i * .01f, .25f + i * .01f, .26f + i * .01f));
            SoftenSmoke(smokePuffs[i], .055f + i * .012f);
        }
        GameObject lightObject = new GameObject("Engine exhaust glow"); lightObject.transform.SetParent(RocketRoot, false); lightObject.transform.localPosition = new Vector3(0, -3.25f, -.6f); exhaustLight = lightObject.AddComponent<Light>(); exhaustLight.type = LightType.Point; exhaustLight.color = new Color(1f, .22f, .04f); exhaustLight.shadows = LightShadows.None; exhaustLight.enabled = false;
    }

    static void SetEmission(Transform target, Color emission)
    {
        if (target == null) return;
        Renderer renderer = target.GetComponent<Renderer>();
        if (renderer == null) return;
        renderer.material.EnableKeyword("_EMISSION");
        renderer.material.SetColor("_EmissionColor", emission);
    }

    static void SoftenSmoke(Transform target, float alpha)
    {
        if (target == null) return;
        Renderer renderer = target.GetComponent<Renderer>();
        if (renderer == null) return;
        Material material = renderer.material;
        Color color = material.color; color.a = alpha; material.color = color;
        if (material.HasProperty("_Mode")) material.SetFloat("_Mode", 3f);
        if (material.HasProperty("_Surface")) material.SetFloat("_Surface", 1f);
        material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
        material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
        material.SetInt("_ZWrite", 0);
        material.DisableKeyword("_ALPHATEST_ON"); material.EnableKeyword("_ALPHABLEND_ON"); material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
        material.renderQueue = 3000;
    }

    static float EaseOut(float value) => 1f - Mathf.Pow(1f - Mathf.Clamp01(value), 3f);

    Transform BuildFallbackStack()
    {
        Transform stack = new GameObject("Animated SLS separation stack").transform;
        stack.SetParent(RocketRoot, false);
        // Preserve SLS silhouette: tall core, narrow body, wide paired boosters.
        stack.localScale = new Vector3(1.15f, 1.0f, 1.15f);
        // Keep fallback engine bells on deck; previous offset floated the stack.
        stack.localPosition = Vector3.up * -.5f;
        Transform coreStage = new GameObject("CoreStage").transform;
        coreStage.SetParent(stack, false);
        Primitive("Fallback orange core", PrimitiveType.Cylinder, coreStage, Vector3.zero, new Vector3(1.65f, 3.4f, 1.65f), new Color(.82f, .34f, .09f));
        Primitive("Core white aft skirt", PrimitiveType.Cylinder, coreStage, new Vector3(0, -3.55f, 0), new Vector3(1.86f, .22f, 1.86f), new Color(.86f, .87f, .88f));
        Primitive("Core aft skirt", PrimitiveType.Cylinder, coreStage, new Vector3(0, -3.56f, 0), new Vector3(1.8f, .28f, 1.8f), new Color(.1f, .12f, .15f));
        Primitive("Core forward skirt", PrimitiveType.Cylinder, coreStage, new Vector3(0, 3.56f, 0), new Vector3(1.72f, .2f, 1.72f), new Color(.1f, .12f, .15f));
        for (int band = -1; band <= 1; band++)
            Primitive("Core tank band", PrimitiveType.Cylinder, coreStage, new Vector3(0, band * 1.72f, 0), new Vector3(1.67f, .045f, 1.67f), new Color(.95f, .46f, .08f));
        for (int engine = -1; engine <= 0; engine++)
            Primitive("RS-25 engine", PrimitiveType.Cylinder, coreStage, new Vector3(engine * .34f, -3.9f, -.22f), new Vector3(.28f, .22f, .28f), new Color(.07f, .08f, .1f));
        Primitive("RS-25 engine 3", PrimitiveType.Cylinder, coreStage, new Vector3(0, -3.9f, .32f), new Vector3(.28f, .22f, .28f), new Color(.07f, .08f, .1f));
        Transform upper = new GameObject("ICPS").transform;
        upper.SetParent(stack, false);
        upper.localPosition = new Vector3(0, 4.22f, 0);
        Primitive("Fallback ICPS", PrimitiveType.Cylinder, upper, Vector3.zero, new Vector3(.82f, .7f, .82f), new Color(.76f, .78f, .82f));
        Primitive("ICPS engine skirt", PrimitiveType.Cylinder, upper, new Vector3(0, -.85f, 0), new Vector3(.92f, .14f, .92f), new Color(.12f, .14f, .17f));
        Primitive("ICPS forward band", PrimitiveType.Cylinder, upper, new Vector3(0, .72f, 0), new Vector3(.86f, .08f, .86f), new Color(.18f, .2f, .24f));
        Transform orionStack = new GameObject("Orion").transform;
        orionStack.SetParent(stack, false);
        Primitive("Service module", PrimitiveType.Cylinder, orionStack, new Vector3(0, 5.45f, 0), new Vector3(.96f, .34f, .96f), new Color(.62f, .65f, .68f));
        Primitive("Service module band", PrimitiveType.Cylinder, orionStack, new Vector3(0, 5.78f, 0), new Vector3(1f, .08f, 1f), new Color(.25f, .28f, .32f));
        Primitive("Crew module heat shield", PrimitiveType.Sphere, orionStack, new Vector3(0, 6.38f, 0), new Vector3(1.2f, .9f, 1.2f), new Color(.18f, .2f, .23f));
        Primitive("Crew module", PrimitiveType.Sphere, orionStack, new Vector3(0, 6.72f, 0), new Vector3(.98f, .55f, .98f), new Color(.9f, .91f, .92f));
        Primitive("Crew window", PrimitiveType.Cube, orionStack, new Vector3(0, 6.76f, -.48f), new Vector3(.4f, .16f, .025f), new Color(.03f, .12f, .18f));
        Primitive("Launch escape tower", PrimitiveType.Cylinder, orionStack, new Vector3(0, 7.56f, 0), new Vector3(.18f, .5f, .18f), new Color(.12f, .14f, .17f));
        Primitive("LAS arm left", PrimitiveType.Cube, orionStack, new Vector3(-.28f, 7.35f, 0), new Vector3(.12f, .5f, .12f), new Color(.12f, .14f, .17f));
        Primitive("LAS arm right", PrimitiveType.Cube, orionStack, new Vector3(.28f, 7.35f, 0), new Vector3(.12f, .5f, .12f), new Color(.12f, .14f, .17f));
        Primitive("SolarWing_Left", PrimitiveType.Cube, orionStack, new Vector3(-1.35f, 5.45f, 0), new Vector3(1.2f, .035f, .42f), new Color(.025f, .1f, .28f));
        Primitive("SolarWing_Right", PrimitiveType.Cube, orionStack, new Vector3(1.35f, 5.45f, 0), new Vector3(1.2f, .035f, .42f), new Color(.025f, .1f, .28f));
        for (int side = -1; side <= 1; side += 2)
        {
            Transform booster = new GameObject(side < 0 ? "SRB_Left" : "SRB_Right").transform;
            booster.SetParent(stack, false); booster.localPosition = new Vector3(side * 1.2f, 0, 0);
            Primitive("Fallback solid booster", PrimitiveType.Cylinder, booster, new Vector3(0, .05f, 0), new Vector3(.72f, 3.45f, .72f), new Color(.9f, .89f, .84f));
            Primitive("Fallback booster nose", PrimitiveType.Sphere, booster, new Vector3(0, 3.58f, 0), new Vector3(.72f, .42f, .72f), new Color(.9f, .89f, .84f));
            Primitive("Fallback booster aft skirt", PrimitiveType.Cylinder, booster, new Vector3(0, -3.52f, 0), new Vector3(.88f, .2f, .88f), new Color(.12f, .14f, .17f));
            Primitive("Fallback booster separation band", PrimitiveType.Cube, booster, new Vector3(0, .85f, -.31f), new Vector3(.35f, .12f, .025f), new Color(.03f, .03f, .04f));
            Primitive("Fallback NASA mark", PrimitiveType.Cube, booster, new Vector3(0, 1.45f, -.31f), new Vector3(.3f, .46f, .025f), new Color(.72f, .05f, .04f));
            Primitive("Booster aft fin", PrimitiveType.Cube, booster, new Vector3(0, -2.45f, side * .42f), new Vector3(.08f, .65f, .18f), new Color(.18f, .2f, .23f));
        }
        stack.gameObject.SetActive(false);
        return stack;
    }

    static Transform Primitive(string name, PrimitiveType type, Transform parent, Vector3 position, Vector3 scale, Color color)
    {
        GameObject go = GameObject.CreatePrimitive(type); go.name = name; go.transform.SetParent(parent); go.transform.localPosition = position; go.transform.localScale = scale;
        Renderer renderer = go.GetComponent<Renderer>(); renderer.material.color = color; renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; renderer.receiveShadows = false;
        Collider collider = go.GetComponent<Collider>(); if (collider != null) collider.enabled = false;
        return go.transform;
    }
}
