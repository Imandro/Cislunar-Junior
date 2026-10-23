using System.Collections;
using NUnit.Framework;
using System.Reflection;
using UnityEngine;
using UnityEngine.TestTools;

public sealed class LaunchVehiclePlayModeTests
{
    [UnityTest]
    public IEnumerator CockpitMainCameraExcludesExteriorLayer()
    {
        var host = new GameObject("simulator-layer-test");
        host.AddComponent<CislunarSimulator>();
        yield return null;

        var cameraField = typeof(CislunarSimulator).GetField("simulatorCamera", BindingFlags.Instance | BindingFlags.NonPublic);
        var camera = cameraField?.GetValue(host.GetComponent<CislunarSimulator>()) as Camera;
        Assert.That(camera, Is.Not.Null);
        Assert.That(camera.cullingMask & (1 << 8), Is.EqualTo(0));

        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator ExteriorAndWindowUseOnlyExteriorLayer()
    {
        var host = new GameObject("simulator-window-layer-test");
        var simulator = host.AddComponent<CislunarSimulator>();
        yield return null;

        var cameraField = typeof(CislunarSimulator).GetField("simulatorCamera", BindingFlags.Instance | BindingFlags.NonPublic);
        var windowField = typeof(CislunarSimulator).GetField("windowCamera", BindingFlags.Instance | BindingFlags.NonPublic);
        var setView = typeof(CislunarSimulator).GetMethod("SetView", BindingFlags.Instance | BindingFlags.NonPublic);
        var camera = cameraField?.GetValue(simulator) as Camera;
        var window = windowField?.GetValue(simulator) as Camera;
        Assert.That(camera, Is.Not.Null);
        Assert.That(window, Is.Not.Null);
        Assert.That(window.cullingMask, Is.EqualTo(1 << 8));

        setView.Invoke(simulator, new object[] { ViewMode.Exterior });
        Assert.That(camera.cullingMask, Is.EqualTo(1 << 8));
        setView.Invoke(simulator, new object[] { ViewMode.Cockpit });
        Assert.That(camera.cullingMask & (1 << 8), Is.EqualTo(0));

        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator ExteriorCamerasHaveMetricTrackingClipRange()
    {
        var host = new GameObject("simulator-metric-camera-test");
        var simulator = host.AddComponent<CislunarSimulator>();
        yield return null;

        var camera = (Camera)typeof(CislunarSimulator).GetField("simulatorCamera", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var window = (Camera)typeof(CislunarSimulator).GetField("windowCamera", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        Assert.That(camera.farClipPlane, Is.GreaterThanOrEqualTo(5000f));
        Assert.That(window.farClipPlane, Is.GreaterThanOrEqualTo(5000f));
        Assert.That(LaunchVehicleController.WorldMetersPerUnit, Is.EqualTo(1f));

        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator RuntimeVehicleEffectsStayOnExteriorLayer()
    {
        var host = new GameObject("simulator-runtime-layer-test");
        var simulator = host.AddComponent<CislunarSimulator>();
        yield return null;

        var root = (Transform)typeof(CislunarSimulator).GetField("rocketRoot", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        Assert.That(root, Is.Not.Null);
        Assert.That(FindChild(root, "RS25 plume").gameObject.layer, Is.EqualTo(8));
        Assert.That(FindChild(root, "Launch smoke puff 0").gameObject.layer, Is.EqualTo(8));

        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator ExteriorEnvironmentMatchesMarsLandingAndFinalFrame()
    {
        var host = new GameObject("simulator-environment-test");
        var simulator = host.AddComponent<CislunarSimulator>();
        yield return null;

        var startMission = typeof(CislunarSimulator).GetMethod("StartMission", BindingFlags.Instance | BindingFlags.NonPublic);
        startMission.Invoke(simulator, new object[] { MissionProfile.MarsMission });
        var missionField = typeof(CislunarSimulator).GetField("mission", BindingFlags.Instance | BindingFlags.NonPublic);
        var mission = missionField.GetValue(simulator) as MissionModel;
        SetPrivate(mission, "<Phase>k__BackingField", FlightPhase.Descent);
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 12f);

        var refresh = typeof(CislunarSimulator).GetMethod("UpdateExteriorEnvironment", BindingFlags.Instance | BindingFlags.NonPublic);
        refresh.Invoke(simulator, null);
        var mars = (Transform)typeof(CislunarSimulator).GetField("marsSurfaceRoot", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var earth = (Transform)typeof(CislunarSimulator).GetField("launchPadRoot", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var lunar = (Transform)typeof(CislunarSimulator).GetField("lunarSurfaceRoot", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var earthBackdrop = (Transform)typeof(CislunarSimulator).GetField("earthBackdropRoot", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        Assert.That(mars.Find("Mars dune"), Is.Not.Null, "Mars needs visible dunes in exterior.");
        Assert.That(mars.Find("Mars rock"), Is.Not.Null, "Mars needs scattered rocks in exterior.");
        Assert.That(lunar.Find("Luna crater rim"), Is.Not.Null, "Moon needs crater relief in exterior.");
        Assert.That(earthBackdrop.Find("Earth cloud bank"), Is.Not.Null, "Earth launch view needs layered clouds.");
        Assert.That(mars.gameObject.activeSelf, Is.True);
        Assert.That(earth.gameObject.activeSelf, Is.False);

        startMission.Invoke(simulator, new object[] { MissionProfile.ArtemisIIExtended });
        mission = missionField.GetValue(simulator) as MissionModel;
        SetPrivate(mission, "<Phase>k__BackingField", FlightPhase.Ascent);
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 45f);
        refresh.Invoke(simulator, null);
        Assert.That(earth.gameObject.activeSelf, Is.False, "Launch pad must clear once ascent starts.");

        startMission.Invoke(simulator, new object[] { MissionProfile.MarsMission });
        mission = missionField.GetValue(simulator) as MissionModel;
        SetPrivate(mission, "<Phase>k__BackingField", FlightPhase.Complete);
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 0f);
        refresh.Invoke(simulator, null);
        Assert.That(mars.gameObject.activeSelf, Is.True, "Mars surface must remain visible on the final mission frame.");

        Object.Destroy(host);
        yield return null;
    }

    static void SetPrivate(object target, string fieldName, object value)
    {
        var field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.That(field, Is.Not.Null, fieldName);
        field.SetValue(target, value);
    }

    [Test]
    public void ControlsStayInsideEducationalLimits()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SetControls(2f, 90f, -90f, 90f);

        Assert.That(mission.Throttle, Is.EqualTo(1f));
        Assert.That(mission.Pitch, Is.EqualTo(45f));
        Assert.That(mission.Yaw, Is.EqualTo(-45f));
        Assert.That(mission.Roll, Is.EqualTo(45f));
    }

    [UnityTest]
    public IEnumerator OfficialSlsMeshBecomesTexturedSeparableModules()
    {
        var source = Resources.Load<GameObject>("NASA/Artemis2_reference");
        var texture = Resources.Load<Texture2D>("NASA/Artemis2_SLS");
        Assert.That(source, Is.Not.Null);
        Assert.That(texture, Is.Not.Null);

        var utilityHost = new GameObject("import-helper"); utilityHost.SetActive(false);
        var utility = utilityHost.AddComponent<CislunarSimulator>();
        var host = new GameObject("official-sls-separation-test");
        var root = new GameObject("rocket").transform; root.SetParent(host.transform); root.position = new Vector3(0, 3f, 16f);
        var instantiate = typeof(CislunarSimulator).GetMethod("InstantiateScaled", BindingFlags.Instance | BindingFlags.NonPublic);
        var sls = (GameObject)instantiate.Invoke(utility, new object[] { source, root, "NASA SLS Block 1", 11f });
        var flip = typeof(CislunarSimulator).GetMethod("FlipImportedSlsToLaunchOrientation", BindingFlags.Static | BindingFlags.NonPublic);
        flip.Invoke(null, new object[] { sls.transform, root, 11f });
        var applyTexture = typeof(CislunarSimulator).GetMethod("ApplySlsTexture", BindingFlags.Static | BindingFlags.NonPublic);
        applyTexture.Invoke(null, new object[] { sls, texture });

        var orion = new GameObject("orion"); orion.transform.SetParent(root);
        var controller = host.AddComponent<LaunchVehicleController>();
        controller.Configure(root, sls, orion, null, null);
        Assert.That(controller.UsingOfficialSeparatedGeometry, Is.True, "Separation must use geometry cut from the supplied SLS FBX.");
        Assert.That(controller.SRBLeft.GetComponent<MeshFilter>().sharedMesh.triangles.Length / 3, Is.GreaterThan(4500), "The left SRB must be a complete connected shell, not a cable fragment.");
        Assert.That(controller.SRBRight.GetComponent<MeshFilter>().sharedMesh.triangles.Length / 3, Is.GreaterThan(4500), "The right SRB must be a complete connected shell, not a cable fragment.");
        Assert.That(controller.SRBLeft.GetComponent<MeshFilter>().sharedMesh.vertexCount, Is.GreaterThan(100));
        Assert.That(controller.SRBRight.GetComponent<MeshFilter>().sharedMesh.vertexCount, Is.GreaterThan(100));
        Assert.That(controller.CoreStage.GetComponent<MeshFilter>().sharedMesh.vertexCount, Is.GreaterThan(100));
        Assert.That(controller.ICPS.GetComponent<MeshFilter>().sharedMesh.vertexCount, Is.GreaterThan(100));
        Assert.That(controller.SRBLeft.GetComponent<MeshRenderer>().sharedMaterial.mainTexture, Is.SameAs(texture));

        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        controller.Tick(.1f, mission);
        Assert.That(sls.activeSelf, Is.True);
        Assert.That(controller.SRBLeft.gameObject.activeInHierarchy, Is.False, "Separated geometry stays hidden before SRB release.");
        SetPrivate(mission, "<Phase>k__BackingField", FlightPhase.Ascent);
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 25f);
        SetPrivate(mission, "<VelocityMs>k__BackingField", 1000f);
        mission.SetLaunchState(LaunchVehicleState.Ascent);
        Assert.That(mission.TrySeparateStage(), Is.True);
        controller.Tick(.1f, mission);
        Assert.That(sls.activeSelf, Is.False, "Hide the monolithic source while its sliced meshes animate.");
        Assert.That(controller.SRBLeft.gameObject.activeInHierarchy, Is.True);
        Assert.That(controller.SRBRight.gameObject.activeInHierarchy, Is.True);
        Assert.That(controller.SRBLeft.GetComponent<MeshRenderer>().sharedMaterial.mainTexture, Is.SameAs(texture));

        Vector3 leftAtRelease = controller.SRBLeft.position;
        controller.Tick(1f, mission);
        Assert.That(Vector3.Distance(controller.SRBLeft.position, leftAtRelease), Is.GreaterThan(.1f));
        controller.Tick(4f, mission);
        Assert.That(controller.SRBLeft.gameObject.activeSelf, Is.False, "Spent boosters must leave the camera after separation.");

        SetPrivate(mission, "separationIndex", 1);
        SetPrivate(mission, "<Phase>k__BackingField", FlightPhase.ParkingOrbit);
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 170f);
        SetPrivate(mission, "<VelocityMs>k__BackingField", 7100f);
        Assert.That(mission.TrySeparateStage(), Is.True);
        controller.Tick(.1f, mission);
        Assert.That(controller.CoreStage.gameObject.activeSelf, Is.True, "The supplied core mesh should animate away during separation.");
        mission.SetLaunchState(LaunchVehicleState.ICPSBurn);
        controller.Tick(.1f, mission);
        Assert.That(controller.CoreStage.gameObject.activeSelf, Is.False);
        Assert.That(controller.ICPS.gameObject.activeSelf, Is.True);

        Object.Destroy(host); Object.Destroy(utilityHost);
        yield return null;
    }

    [Test]
    public void SeparationRequiresValidAscentState()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        Assert.That(mission.TrySeparateStage(), Is.False);

        mission.EnableFreeFlight();
        mission.Step(30f, 1f);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Ascent));
        mission.Step(10f, 1f);
        Assert.That(mission.TrySeparateStage(), Is.True);
        Assert.That(mission.LaunchState, Is.EqualTo(LaunchVehicleState.SRBSeparation));
    }

    [UnityTest]
    public IEnumerator ControllerMovesStackAndDisablesSeparatedStage()
    {
        var host = new GameObject("vehicle-test");
        var root = new GameObject("rocket").transform; root.SetParent(host.transform);
        root.position = new Vector3(0, 2.2f, 16f);
        var sls = new GameObject("sls"); sls.transform.SetParent(root);
        var orion = new GameObject("orion"); orion.transform.SetParent(root);
        var lander = new GameObject("lander"); lander.transform.SetParent(root);
        var separated = new GameObject("separated").transform;
        var controller = host.AddComponent<LaunchVehicleController>();
        controller.Configure(root, sls, orion, lander, separated);
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);

        controller.Tick(.1f, mission);
        Debug.Log($"DEBUG vehicle bounds={controller.VisualBounds} radius={controller.VisualRadius} root={root.position}");
        Assert.That(controller.UsingAnimatedFallback, Is.True);
        Assert.That(sls.activeSelf, Is.False);
        Assert.That(orion.activeSelf, Is.False);
        Assert.That(controller.VisualRadius, Is.GreaterThan(4f));
        Assert.That(controller.CoreStage.position.y, Is.LessThan(root.position.y + 1f), "Core stage must start aligned with the pad, not above the vehicle.");
        Assert.That(controller.SRBLeft.position.z, Is.EqualTo(root.position.z).Within(.001f));

        mission.EnableFreeFlight();
        mission.Step(12f, 1f);
        controller.Tick(.1f, mission);
        Assert.That(root.position.y, Is.GreaterThan(0));
        Assert.That(root.position.y, Is.GreaterThan(2.2f), "Ascent must visibly clear the pad.");
        Assert.That(root.Find("RS25 plume").gameObject.activeSelf, Is.True, "Powered ascent must show plume.");

        Object.Destroy(host);
        Object.Destroy(separated.gameObject);
        yield return null;
    }

    [UnityTest]
    public IEnumerator CampaignLaunchLeavesPadWithoutFreeFlight()
    {
        var host = new GameObject("campaign-launch-test");
        var root = new GameObject("rocket").transform; root.SetParent(host.transform); root.position = new Vector3(0, 2.2f, 16f);
        var sls = new GameObject("sls"); sls.transform.SetParent(root);
        var orion = new GameObject("orion"); orion.transform.SetParent(root);
        var controller = host.AddComponent<LaunchVehicleController>(); controller.Configure(root, sls, orion, null, null);
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);

        mission.RequestLaunch();
        mission.Step(11f, 1f);
        controller.Tick(.1f, mission);

        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Launch));
        Assert.That(root.position.y, Is.GreaterThan(2.2f), "Campaign launch must leave the deck without Space.");
        Assert.That(root.Find("RS25 plume").gameObject.activeSelf, Is.True);
        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator ExteriorCameraStaysLockedToRocketDuringAscent()
    {
        var host = new GameObject("camera-ascent-lock-test");
        var simulator = host.AddComponent<CislunarSimulator>();
        yield return null;

        var mission = (MissionModel)typeof(CislunarSimulator).GetField("mission", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var root = (Transform)typeof(CislunarSimulator).GetField("rocketRoot", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var controller = (LaunchVehicleController)typeof(CislunarSimulator).GetField("vehicleController", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var camera = (Camera)typeof(CislunarSimulator).GetField("simulatorCamera", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var lookField = typeof(CislunarSimulator).GetField("exteriorLookTarget", BindingFlags.Instance | BindingFlags.NonPublic);
        var setView = typeof(CislunarSimulator).GetMethod("SetView", BindingFlags.Instance | BindingFlags.NonPublic);
        var updateCamera = typeof(CislunarSimulator).GetMethod("UpdateCamera", BindingFlags.Instance | BindingFlags.NonPublic);
        setView.Invoke(simulator, new object[] { ViewMode.Exterior });
        mission.EnableFreeFlight();
        for (int i = 0; i < 160 && mission.Phase != FlightPhase.Ascent; i++) mission.Step(.25f, 1f);
        controller.Tick(.1f, mission);
        updateCamera.Invoke(simulator, null);

        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Ascent));
        Vector3 lookTarget = (Vector3)lookField.GetValue(simulator);
        Assert.That(Mathf.Abs(lookTarget.y - root.position.y), Is.LessThan(10f), "Exterior camera must follow RocketRoot during ascent.");
        Assert.That(Vector3.Dot(camera.transform.forward, (lookTarget - camera.transform.position).normalized), Is.GreaterThan(.99f));

        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator ExteriorOrbitRotatesAroundTheActiveVehicle()
    {
        var host = new GameObject("camera-orbit-test");
        var simulator = host.AddComponent<CislunarSimulator>();
        yield return null;
        var type = typeof(CislunarSimulator);
        var setView = type.GetMethod("SetView", BindingFlags.Instance | BindingFlags.NonPublic);
        var updateCamera = type.GetMethod("UpdateCamera", BindingFlags.Instance | BindingFlags.NonPublic);
        var camera = (Camera)type.GetField("simulatorCamera", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var look = type.GetField("exteriorLookTarget", BindingFlags.Instance | BindingFlags.NonPublic);
        setView.Invoke(simulator, new object[] { ViewMode.Exterior });
        updateCamera.Invoke(simulator, null);
        Vector3 first = camera.transform.position;
        type.GetField("exteriorOrbitYaw", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(simulator, 90f);
        setView.Invoke(simulator, new object[] { ViewMode.Exterior });
        updateCamera.Invoke(simulator, null);
        Vector3 target = (Vector3)look.GetValue(simulator);
        Assert.That(Vector3.Distance(first, camera.transform.position), Is.GreaterThan(5f));
        Assert.That(Vector3.Dot(camera.transform.forward, (target - camera.transform.position).normalized), Is.GreaterThan(.99f));
        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator SuppliedOrionRendersWithItsOwnSolarPanels()
    {
        var host = new GameObject("imported-orion-test");
        var simulator = host.AddComponent<CislunarSimulator>();
        yield return null;
        var root = (Transform)typeof(CislunarSimulator).GetField("rocketRoot", BindingFlags.Instance | BindingFlags.NonPublic).GetValue(simulator);
        var imported = FindChild(root, "NASA Orion capsule");
        Assert.That(imported, Is.Not.Null, "The supplied Orion FBX must load in Exterior.");
        Assert.That(FindChild(root, "Orion capsule fallback"), Is.Null);
        Assert.That(FindChild(imported, "CrewModule_Body"), Is.Not.Null);
        Assert.That(FindChild(imported, "SolarWing_Left"), Is.Not.Null);
        Assert.That(FindChild(imported, "SolarWing_Right"), Is.Not.Null);
        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator LayeredExhaustRunsOnlyDuringPoweredFlight()
    {
        var host = new GameObject("layered-effects-test");
        var root = new GameObject("rocket").transform; root.SetParent(host.transform);
        var sls = new GameObject("sls"); sls.transform.SetParent(root);
        var orion = new GameObject("orion"); orion.transform.SetParent(root);
        var controller = host.AddComponent<LaunchVehicleController>();
        controller.Configure(root, sls, orion, null, null);
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);

        controller.Tick(.1f, mission);
        Assert.That(root.Find("RS25 plume").gameObject.activeSelf, Is.False);
        Assert.That(root.Find("RS25 plume inner").gameObject.activeSelf, Is.False);

        mission.EnableFreeFlight();
        mission.Step(12f, 1f);
        controller.Tick(.1f, mission);
        Assert.That(root.Find("RS25 plume").gameObject.activeSelf, Is.True);
        Assert.That(root.Find("RS25 plume inner").gameObject.activeSelf, Is.True);
        Assert.That(root.Find("RS25 plume halo").gameObject.activeSelf, Is.True);
        Assert.That(FindChild(root, "Launch smoke puff 0").gameObject.activeSelf, Is.True);

        mission.SetLaunchState(LaunchVehicleState.Translunar);
        controller.Tick(.1f, mission);
        Assert.That(root.Find("RS25 plume").gameObject.activeSelf, Is.False);
        Assert.That(root.Find("RS25 plume inner").gameObject.activeSelf, Is.False);
        Assert.That(FindChild(root, "Launch smoke puff 0").gameObject.activeSelf, Is.False);

        Object.Destroy(host);
        yield return null;
    }

    [Test]
    public void PhaseTimerResetsWhenAdvancingMilestone()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        mission.Step(13f, 1f);
        var phaseTimer = typeof(MissionModel).GetField("<PhaseElapsedSeconds>k__BackingField", BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.That((float)phaseTimer.GetValue(mission), Is.GreaterThan(0));
        mission.AdvancePhase();
        Assert.That((float)phaseTimer.GetValue(mission), Is.EqualTo(0));
    }

    [UnityTest]
    public IEnumerator HybridStackDoesNotShowASecondOrionBeforeTranslunar()
    {
        var host = new GameObject("hybrid-orion-test");
        var root = new GameObject("rocket").transform; root.SetParent(host.transform);
        var sls = new GameObject("sls"); sls.transform.SetParent(root);
        var orion = new GameObject("orion"); orion.transform.SetParent(root);
        var controller = host.AddComponent<LaunchVehicleController>();
        controller.Configure(root, sls, orion, null, null);
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        for (int i = 0; i < 2000 && mission.Phase != FlightPhase.ParkingOrbit; i++) mission.Step(.25f, 1f);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.ParkingOrbit));

        controller.Tick(.1f, mission);
        Assert.That(orion.activeSelf, Is.False, "The launch stack already contains Orion during ICPS flight.");
        Assert.That(root.Find("Animated SLS separation stack").gameObject.activeSelf, Is.True);

        mission.SetLaunchState(LaunchVehicleState.ICPSBurn);
        controller.Tick(.1f, mission);
        var plume = root.Find("RS25 plume");
        Assert.That(plume.localPosition.y + plume.localScale.y * .5f, Is.EqualTo(3.15f).Within(.001f), "ICPS flame must start below its nozzle.");

        mission.SetLaunchState(LaunchVehicleState.Translunar);
        controller.Tick(.1f, mission);
        Assert.That(orion.activeSelf, Is.True);
        Assert.That(root.Find("Animated SLS separation stack").gameObject.activeSelf, Is.False);
        Assert.That(plume.gameObject.activeSelf, Is.False);
        Object.Destroy(host);
        yield return null;
    }

    [UnityTest]
    public IEnumerator HybridStackShowsSeparatedBoostersAndCore()
    {
        var host = new GameObject("hybrid-vehicle-test");
        var root = new GameObject("rocket").transform; root.SetParent(host.transform);
        var sls = new GameObject("sls"); sls.transform.SetParent(root);
        var orion = new GameObject("orion"); orion.transform.SetParent(root);
        var lander = new GameObject("lander"); lander.transform.SetParent(root);
        var separated = new GameObject("separated").transform;
        var controller = host.AddComponent<LaunchVehicleController>();
        controller.Configure(root, sls, orion, lander, separated);
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();

        for (int i = 0; i < 80; i++) mission.Step(1f, 1f);
        if (!mission.SRBsSeparated) mission.TrySeparateStage();
        controller.Tick(.1f, mission);
        Assert.That(controller.UsingAnimatedFallback, Is.True);
        Assert.That(controller.SRBLeft, Is.Not.Null);
        Assert.That(controller.SRBRight, Is.Not.Null);

        for (int i = 0; i < 260; i++) mission.Step(1f, 1f);
        controller.Tick(.1f, mission);
        Assert.That(mission.CoreSeparated, Is.True);
        Assert.That(controller.CoreStage.gameObject.activeSelf, Is.False);
        Assert.That(controller.ICPS.gameObject.activeSelf, Is.True);
        Assert.That(root.Find("Animated SLS separation stack/Orion/SolarWing_Left").localScale.x, Is.GreaterThan(0f));

        Object.Destroy(host);
        Object.Destroy(separated.gameObject);
        yield return null;
    }

    static Transform FindChild(Transform root, string name)
    {
        Transform searchRoot = root != null && root.parent != null ? root.parent : root;
        foreach (Transform child in searchRoot.GetComponentsInChildren<Transform>(true))
            if (child.name == name) return child;
        return null;
    }
}
