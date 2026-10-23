using System;
using System.Collections.Generic;
using UnityEngine;

public sealed class CislunarSimulator : MonoBehaviour
{
    struct EnvironmentSnapshot
    {
        public string body;
        public string atmosphere;
        public float altitudeKm;
        public Color sky;
        public bool stars;
        public bool clouds;
    }

    const float HeadYawLimit = 45f;
    const float HeadPitchLimit = 25f;
    const int ExteriorLayer = 8;

    MissionModel mission;
    ViewMode view = ViewMode.Cockpit;
    CockpitFocus focus = CockpitFocus.Overview;
    Camera simulatorCamera;
    Camera windowCamera;
    RenderTexture windowTexture;
    Transform cockpitRoot, exteriorRoot, routeRoot;
    Transform launchPadRoot, launchTower, lunarSurfaceRoot, marsSurfaceRoot, earthOceanRoot, earthBackdropRoot;
    Transform rocketRoot;
    GameObject slsVisual, orionVisual, landerVisual;
    Texture2D officialSlsTexture;
    LaunchVehicleController vehicleController;
    TextMesh routeReadout, flightReadout, systemsReadout;
    Renderer forwardWindow;
    Renderer atmosphereHorizon, atmosphereMidHorizon, atmosphereUpperHorizon, atmosphereSpaceHorizon;
    readonly List<Renderer> starRenderers = new List<Renderer>();
    Material windowMaterial;
    Transform[] displays = new Transform[3];
    Transform routeShip;
    Vector3 cameraVelocity;
    Vector3 exteriorTargetVelocity;
    Vector3 exteriorLookTarget;
    FlightPhase exteriorPhaseCache;
    LaunchVehicleState exteriorLaunchStateCache;
    bool exteriorCameraInitialized;
    float cabinShake;
    float routeZoom = 1f, exteriorZoom = 1f;
    float exteriorOrbitYaw, exteriorOrbitPitch;
    float yaw, pitch, throttle = .72f, vehicleYaw, vehiclePitch, vehicleRoll;
    Vector3 pointerStart;
    bool looking, tutorial = true, missionMenu = true, paused;
    Color renderedAtmosphereColor;
    Color environmentSkyColor;
    bool environmentStarsVisible;
    bool atmosphereColorReady;
    EnvironmentSnapshot environmentSnapshot;
    GUIStyle titleStyle, textStyle, valueStyle, buttonStyle;

    void Awake()
    {
        Application.targetFrameRate = 60;
        QualitySettings.shadows = ShadowQuality.Disable;
        // Maximized bordered window; avoids exclusive fullscreen focus and scaling bugs.
        Screen.fullScreenMode = FullScreenMode.Windowed;
        int desktopWidth = UnityEngine.Display.main == null ? 1440 : UnityEngine.Display.main.systemWidth;
        int desktopHeight = UnityEngine.Display.main == null ? 810 : UnityEngine.Display.main.systemHeight;
        Screen.SetResolution(Mathf.Max(800, desktopWidth - 80), Mathf.Max(700, desktopHeight - 100), FullScreenMode.Windowed);
        mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        CreateCamera(); CreateWorld(); SetView(ViewMode.Cockpit);
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1)) StartMission(MissionProfile.ArtemisIIExtended);
        if (Input.GetKeyDown(KeyCode.Alpha2)) StartMission(MissionProfile.LunarLanding);
        if (Input.GetKeyDown(KeyCode.Alpha3)) StartMission(MissionProfile.MarsMission);
        if (Input.GetKeyDown(KeyCode.Tab)) SetView((ViewMode)(((int)view + 1) % 3));
        if (Input.GetKeyDown(KeyCode.F1)) Focus(CockpitFocus.Route);
        if (Input.GetKeyDown(KeyCode.F2)) Focus(CockpitFocus.Flight);
        if (Input.GetKeyDown(KeyCode.F3)) Focus(CockpitFocus.Systems);
        if (Input.GetKeyDown(KeyCode.H)) tutorial = true;
        if (Input.GetKeyDown(KeyCode.P)) paused = !paused;
        if (Input.GetKeyDown(KeyCode.Escape)) { if (tutorial) tutorial = false; else if (view == ViewMode.Cockpit && focus != CockpitFocus.Overview) focus = CockpitFocus.Overview; else paused = !paused; }
        if (Input.GetKeyDown(KeyCode.Space) && !missionMenu && !tutorial && !paused) mission.EnableFreeFlight();
        if (Input.GetKeyDown(KeyCode.N) && !missionMenu && !tutorial && !paused)
        {
            if (mission.FreeFlight)
            {
                if (mission.CanSeparateStage) mission.TrySeparateStage();
                else if (mission.Phase == FlightPhase.Ascent && mission.SRBsSeparated) mission.AdvancePhase();
                else if (mission.Phase == FlightPhase.ParkingOrbit && !mission.CoreSeparated) { }
                else if (mission.Phase != FlightPhase.Pad && mission.Phase != FlightPhase.Launch && mission.Phase != FlightPhase.Ascent) mission.AdvancePhase();
            }
            else mission.AdvancePhase();
        }
        if (view == ViewMode.Route && !missionMenu && !tutorial && !paused)
        {
            routeZoom = Mathf.Clamp(routeZoom - Input.mouseScrollDelta.y * .12f, .65f, 1.8f);
            if (Input.GetKeyDown(KeyCode.Equals) || Input.GetKeyDown(KeyCode.KeypadPlus)) routeZoom = Mathf.Min(1.8f, routeZoom + .12f);
            if (Input.GetKeyDown(KeyCode.Minus) || Input.GetKeyDown(KeyCode.KeypadMinus)) routeZoom = Mathf.Max(.65f, routeZoom - .12f);
        }
        if (view == ViewMode.Exterior && !missionMenu && !tutorial && !paused)
            exteriorZoom = Mathf.Clamp(exteriorZoom - Input.mouseScrollDelta.y * .1f, .65f, 1.75f);
        if (view != ViewMode.Route && !missionMenu && !tutorial && !paused)
        {
            throttle = Mathf.Clamp01(throttle + (Input.GetKey(KeyCode.W) ? Time.deltaTime * .35f : 0) - (Input.GetKey(KeyCode.S) ? Time.deltaTime * .35f : 0));
            vehicleYaw = Mathf.Clamp(vehicleYaw + (Input.GetKey(KeyCode.D) ? Time.deltaTime * 28f : 0) - (Input.GetKey(KeyCode.A) ? Time.deltaTime * 28f : 0), -45f, 45f);
            vehiclePitch = Mathf.Clamp(vehiclePitch + (Input.GetKey(KeyCode.DownArrow) ? Time.deltaTime * 24f : 0) - (Input.GetKey(KeyCode.UpArrow) ? Time.deltaTime * 24f : 0), -30f, 30f);
            vehicleRoll = Mathf.Clamp(vehicleRoll + (Input.GetKey(KeyCode.RightArrow) ? Time.deltaTime * 30f : 0) - (Input.GetKey(KeyCode.LeftArrow) ? Time.deltaTime * 30f : 0), -45f, 45f);
        }
        mission.SetControls(throttle, vehiclePitch, vehicleYaw, vehicleRoll);
        ReadHeadLook(); ReadDisplayClick(); if (!paused && !missionMenu && !tutorial) mission.Step(Time.deltaTime, throttle); vehicleController?.Tick(Time.deltaTime, mission); UpdateExteriorEnvironment(); UpdateRouteVisual(); UpdateCamera(); UpdateWindowCamera(); UpdatePhysicalReadouts();
    }

    void ReadHeadLook()
    {
        bool cockpitLook = view == ViewMode.Cockpit && focus == CockpitFocus.Overview;
        bool exteriorLook = view == ViewMode.Exterior;
        if ((!cockpitLook && !exteriorLook) || missionMenu || tutorial || paused) { looking = false; return; }
        if (Input.GetMouseButtonDown(1)) { looking = true; pointerStart = Input.mousePosition; }
        if (Input.GetMouseButtonUp(1)) looking = false;
        if (!looking) return;
        Vector3 delta = Input.mousePosition - pointerStart;
        if (cockpitLook)
        {
            yaw = Mathf.Clamp(yaw + delta.x * .09f, -HeadYawLimit, HeadYawLimit);
            pitch = Mathf.Clamp(pitch - delta.y * .06f, -HeadPitchLimit, HeadPitchLimit);
        }
        else
        {
            exteriorOrbitYaw = Mathf.Repeat(exteriorOrbitYaw + delta.x * .18f, 360f);
            exteriorOrbitPitch = Mathf.Clamp(exteriorOrbitPitch - delta.y * .12f, -65f, 65f);
        }
        pointerStart = Input.mousePosition;
    }

    void OnApplicationFocus(bool hasFocus)
    {
        if (!hasFocus) looking = false;
    }

    void StartMission(MissionProfile profile)
    {
        bool preserveFreeFlight = mission != null && mission.FreeFlight;
        mission.Reset(profile);
        if (preserveFreeFlight) mission.EnableFreeFlight();
        throttle = .72f;
        yaw = pitch = vehicleYaw = vehiclePitch = vehicleRoll = 0;
        routeZoom = exteriorZoom = 1f; exteriorOrbitYaw = exteriorOrbitPitch = 0f; cameraVelocity = Vector3.zero;
        exteriorLookTarget = Vector3.zero; exteriorTargetVelocity = Vector3.zero; exteriorCameraInitialized = false;
        exteriorPhaseCache = mission.Phase; exteriorLaunchStateCache = mission.LaunchState;
        environmentSkyColor = new Color(.015f, .02f, .04f); environmentStarsVisible = false;
        atmosphereColorReady = false;
        focus = CockpitFocus.Overview; missionMenu = false; paused = false; tutorial = true; SetView(ViewMode.Cockpit);
    }

    void Focus(CockpitFocus next) { view = ViewMode.Cockpit; focus = next; SetView(ViewMode.Cockpit); looking = false; }

    void ReadDisplayClick()
    {
        if (view != ViewMode.Cockpit || missionMenu || tutorial || paused || !Input.GetMouseButtonDown(0) || Input.mousePosition.y > Screen.height - 225) return;
        RaycastHit hit;
        if (!Physics.Raycast(simulatorCamera.ScreenPointToRay(Input.mousePosition), out hit, 12f)) return;
        string label = hit.transform.name;
        if (label.StartsWith("DU1")) Focus(CockpitFocus.Route);
        else if (label.StartsWith("DU2")) Focus(CockpitFocus.Flight);
        else if (label.StartsWith("DU3")) Focus(CockpitFocus.Systems);
    }

    void SetView(ViewMode next)
    {
        looking = false;
        view = next;
        cockpitRoot.gameObject.SetActive(next == ViewMode.Cockpit);
        exteriorRoot.gameObject.SetActive(next == ViewMode.Exterior || next == ViewMode.Cockpit);
        routeRoot.gameObject.SetActive(next == ViewMode.Route);
        // Exterior stays active for the window camera. Main camera must never draw it in Cabina/Ruta.
        int exteriorMask = 1 << ExteriorLayer;
        simulatorCamera.cullingMask = next == ViewMode.Exterior ? exteriorMask : ~exteriorMask;
        if (windowCamera != null) windowCamera.enabled = next == ViewMode.Cockpit;
        if (next == ViewMode.Exterior)
        {
            exteriorLookTarget = vehicleController != null ? vehicleController.CameraTarget : (rocketRoot == null ? Vector3.zero : rocketRoot.position);
            exteriorTargetVelocity = Vector3.zero;
            cameraVelocity = Vector3.zero;
            exteriorCameraInitialized = false;
        }
    }

    void CreateCamera()
    {
        GameObject cameraObject = new GameObject("Simulator Camera");
        cameraObject.transform.SetParent(transform);
        simulatorCamera = cameraObject.AddComponent<Camera>();
        simulatorCamera.clearFlags = CameraClearFlags.SolidColor; simulatorCamera.fieldOfView = 62; cameraObject.tag = "MainCamera";
        simulatorCamera.nearClipPlane = .03f;
        // Exterior uses metric world units. Keep enough depth while still
        // allowing the close cockpit camera to use a tight near plane.
        simulatorCamera.farClipPlane = 200000f;
        simulatorCamera.cullingMask = ~(1 << ExteriorLayer);
    }

    void CreateWorld()
    {
        GameObject lightObject = new GameObject("Cabin light"); Light light = lightObject.AddComponent<Light>();
        lightObject.transform.SetParent(transform);
        light.type = LightType.Directional; light.intensity = 1.1f; light.color = new Color(.7f, .82f, 1f); light.transform.rotation = Quaternion.Euler(35, -35, 0);
        cockpitRoot = new GameObject("Cockpit").transform; exteriorRoot = new GameObject("Exterior").transform; routeRoot = new GameObject("Route").transform;
        cockpitRoot.SetParent(transform); exteriorRoot.SetParent(transform); routeRoot.SetParent(transform);
        CreateWindowCamera();
        CreateCockpit(cockpitRoot); CreateExterior(exteriorRoot); CreateRoute(routeRoot);
    }

    void CreateWindowCamera()
    {
        GameObject cameraObject = new GameObject("Cabin exterior window camera");
        cameraObject.transform.SetParent(transform);
        windowCamera = cameraObject.AddComponent<Camera>();
        windowCamera.clearFlags = CameraClearFlags.SolidColor;
        windowCamera.backgroundColor = new Color(.015f, .02f, .04f);
        windowCamera.fieldOfView = 52f;
        windowCamera.nearClipPlane = .05f;
        windowCamera.farClipPlane = 200000f;
        windowCamera.cullingMask = 1 << ExteriorLayer;
        windowTexture = new RenderTexture(1024, 304, 16, RenderTextureFormat.ARGB32) { name = "CabinWindowView" };
        windowTexture.filterMode = FilterMode.Trilinear;
        windowTexture.Create();
        windowCamera.targetTexture = windowTexture;
        windowCamera.enabled = false;
    }

    void CreateCockpit(Transform root)
    {
        Color shell = new Color(.035f, .05f, .075f), panel = new Color(.07f, .09f, .12f), trim = new Color(.16f, .2f, .27f);
        Part(root, "Cabin floor", new Vector3(0, -1.55f, 2.4f), new Vector3(10, .2f, 8), shell);
        Part(root, "Cabin ceiling", new Vector3(0, 2.65f, 2.8f), new Vector3(9.6f, .25f, 5.4f), shell);
        Part(root, "Left interior wall", new Vector3(-4.65f, .45f, 2.55f), new Vector3(.35f, 3.9f, 5.7f), shell);
        Part(root, "Right interior wall", new Vector3(4.65f, .45f, 2.55f), new Vector3(.35f, 3.9f, 5.7f), shell);
        Part(root, "Windshield upper arch", new Vector3(0, 2.12f, 4.9f), new Vector3(9.2f, .32f, .34f), trim);
        Part(root, "Windshield left pillar", new Vector3(-3.72f, .67f, 4.82f), new Vector3(.34f, 2.65f, .34f), trim, new Vector3(0, 0, -12));
        Part(root, "Windshield center pillar", new Vector3(0, .72f, 4.93f), new Vector3(.22f, 2.55f, .28f), trim);
        Part(root, "Windshield right pillar", new Vector3(3.72f, .67f, 4.82f), new Vector3(.34f, 2.65f, .34f), trim, new Vector3(0, 0, 12));
        GameObject window = Part(root, "Window exterior live view", new Vector3(0, .76f, 5.15f), new Vector3(7.2f, 2.15f, .05f), Color.white);
        forwardWindow = window.GetComponent<Renderer>();
        windowMaterial = new Material(Shader.Find("Standard")) { mainTexture = windowTexture, color = Color.white };
        ConfigureTransparentMaterial(windowMaterial, .98f);
        windowMaterial.SetFloat("_Glossiness", .15f);
        forwardWindow.material = windowMaterial;
        forwardWindow.enabled = true;
        window.GetComponent<Collider>().enabled = false;
        Part(root, "Forward window sill", new Vector3(0, -.29f, 4.85f), new Vector3(8.1f, .22f, .38f), trim);
        for (int side = -1; side <= 1; side += 2)
        {
            Part(root, "Overhead window rim", new Vector3(side * 2.55f, 2.45f, 2.7f), new Vector3(2.75f, .12f, 1.7f), trim, new Vector3(22, 0, side * 12));
            GameObject overheadWindow = Part(root, "Overhead window", new Vector3(side * 2.55f, 2.54f, 2.7f), new Vector3(2.35f, .07f, 1.42f), new Color(.045f, .16f, .28f), new Vector3(22, 0, side * 12));
            Renderer overheadRenderer = overheadWindow.GetComponent<Renderer>();
            Material overheadMaterial = new Material(windowMaterial) { color = new Color(.55f, .7f, .82f, .36f) };
            ConfigureTransparentMaterial(overheadMaterial, .36f);
            overheadRenderer.material = overheadMaterial;
            overheadWindow.GetComponent<Collider>().enabled = false;
        }
        Part(root, "Instrument hood", new Vector3(0, 1.15f, 3.82f), new Vector3(8.5f, .22f, 1.15f), new Color(.018f, .025f, .04f), new Vector3(16, 0, 0));
        Part(root, "Main console", new Vector3(0, -.55f, 2.85f), new Vector3(8.65f, .5f, 2.25f), panel, new Vector3(12, 0, 0));
        for (int side = -1; side <= 1; side += 2) Part(root, "Angled console wing", new Vector3(side * 3.73f, -.18f, 3.16f), new Vector3(1.36f, 1.16f, .42f), panel, new Vector3(9, side * 18, 0));
        Part(root, "Center console", new Vector3(0, -1.15f, .72f), new Vector3(1.15f, .42f, 2.8f), new Color(.06f, .075f, .1f), new Vector3(-5, 0, 0));
        Part(root, "Left arm console", new Vector3(-3.25f, -1.03f, 1.25f), new Vector3(1.35f, .28f, 2.1f), panel, new Vector3(-6, 0, -7));
        Part(root, "Right arm console", new Vector3(3.25f, -1.03f, 1.25f), new Vector3(1.35f, .28f, 2.1f), panel, new Vector3(-6, 0, 7));
        Seat(root, -2.1f); Seat(root, 2.1f);
        routeReadout = Display(root, "DU1 ROUTE", new Vector3(-2.66f, .31f, 3.42f), new Color(.08f, .55f, .9f), -18f, "ROUTE\nEARTH  >  LUNA\nNEXT: ASCENT");
        flightReadout = Display(root, "DU2 FLIGHT", new Vector3(0, .52f, 3.22f), new Color(.15f, .8f, .95f), 0f, "FLIGHT\nALT 000.0 KM\nVEL 0000 M/S");
        systemsReadout = Display(root, "DU3 SYSTEMS", new Vector3(2.66f, .31f, 3.42f), new Color(.15f, .82f, .48f), 18f, "SYSTEMS\nPROP 100%\nCOMMS NOMINAL");
        for (int i = -6; i <= 6; i++) Part(root, "Overhead switch", new Vector3(i * .56f, 1.23f, 3.76f), new Vector3(.15f, .2f, .18f), i == 0 ? new Color(.85f, .25f, .12f) : new Color(.12f, .42f, .32f), new Vector3(16, 0, 0));
        ControlStick(root, -1.1f); ControlStick(root, 1.1f);
    }

    void Seat(Transform root, float x)
    {
        Color cushion = new Color(.045f, .055f, .075f), fabric = new Color(.09f, .11f, .14f);
        Part(root, "Seat base", new Vector3(x, -1.16f, .38f), new Vector3(1.5f, .38f, 1.55f), cushion, new Vector3(-12, 0, 0));
        Part(root, "Seat back", new Vector3(x, -.56f, .24f), new Vector3(1.35f, 1.42f, .28f), cushion, new Vector3(-18, 0, 0));
        Part(root, "Headrest", new Vector3(x, .08f, .1f), new Vector3(.82f, .5f, .24f), fabric, new Vector3(-8, 0, 0));
        Part(root, "Seat harness", new Vector3(x - .32f, -.66f, .0f), new Vector3(.1f, 1.1f, .08f), new Color(.46f, .48f, .51f), new Vector3(-24, 0, -8));
        Part(root, "Seat harness", new Vector3(x + .32f, -.66f, .0f), new Vector3(.1f, 1.1f, .08f), new Color(.46f, .48f, .51f), new Vector3(-24, 0, 8));
    }

    void ControlStick(Transform root, float x)
    {
        Part(root, "Hand controller stem", new Vector3(x, -.58f, 1.48f), new Vector3(.13f, .62f, .13f), new Color(.15f, .17f, .2f), new Vector3(-25, 0, 0));
        Part(root, "Hand controller grip", new Vector3(x, -.28f, 1.33f), new Vector3(.32f, .22f, .28f), new Color(.06f, .07f, .08f), new Vector3(-25, 0, 0));
        Part(root, "Controller button", new Vector3(x, -.2f, 1.19f), new Vector3(.1f, .1f, .08f), new Color(.9f, .25f, .12f));
    }

    TextMesh Display(Transform root, string label, Vector3 position, Color accent, float angle, string readout)
    {
        Vector3 rotation = new Vector3(9f, angle, 0);
        Quaternion displayRotation = Quaternion.Euler(rotation);
        Vector3 Place(Vector3 offset) => position + displayRotation * offset;
        Color housing = new Color(.012f, .017f, .025f), edge = new Color(.12f, .15f, .19f);
        Part(root, label + " recessed housing", Place(new Vector3(0, 0, .05f)), new Vector3(2.58f, 1.82f, .32f), housing, rotation);
        Part(root, label + " bezel", position, new Vector3(2.38f, 1.62f, .22f), new Color(.004f, .007f, .011f), rotation);
        GameObject glass = ScreenPart(root, label + " active glass", Place(new Vector3(0, 0, -.125f)), new Vector3(2.12f, 1.34f, .035f), accent, rotation);
        displays[label.StartsWith("DU1") ? 0 : label.StartsWith("DU2") ? 1 : 2] = glass.transform;
        Part(root, label + " top rim", Place(new Vector3(0, .72f, -.15f)), new Vector3(2.28f, .07f, .05f), edge, rotation);
        Part(root, label + " bottom rim", Place(new Vector3(0, -.72f, -.15f)), new Vector3(2.28f, .07f, .05f), edge, rotation);
        Part(root, label + " reflection", Place(new Vector3(-.38f, .29f, -.16f)), new Vector3(.75f, .035f, .016f), Color.white * .42f, rotation);
        for (int side = -1; side <= 1; side += 2)
            for (int row = -3; row <= 3; row++)
            {
                Part(root, label + " side key socket", Place(new Vector3(side * 1.1f, row * .17f, -.15f)), new Vector3(.16f, .13f, .07f), housing, rotation);
                Part(root, label + " side key", Place(new Vector3(side * 1.1f, row * .17f, -.19f)), new Vector3(.095f, .075f, .035f), accent * .7f, rotation);
            }
        for (int row = -2; row <= 2; row++)
            Part(root, label + " data row", Place(new Vector3(-.23f, row * .17f, -.16f)), new Vector3(1.34f - Mathf.Abs(row) * .12f, .025f, .014f), accent * (.42f + row * .03f), rotation);
        Cylinder(root, label + " brightness knob", Place(new Vector3(-.77f, -.88f, -.16f)), .09f, .05f, edge, rotation + new Vector3(90, 0, 0));
        Cylinder(root, label + " page knob", Place(new Vector3(.77f, -.88f, -.16f)), .09f, .05f, edge, rotation + new Vector3(90, 0, 0));
        // Keep readout inside active glass; +X placed text outside the bezel.
        return ScreenText(root, label + " text", Place(new Vector3(-.94f, .49f, -.19f)), rotation, readout, accent);
    }

    TextMesh ScreenText(Transform root, string label, Vector3 position, Vector3 rotation, string value, Color accent)
    {
        GameObject textObject = new GameObject(label);
        textObject.transform.SetParent(root);
        textObject.transform.localPosition = position;
        textObject.transform.localRotation = Quaternion.Euler(rotation);
        TextMesh text = textObject.AddComponent<TextMesh>();
        text.text = value;
        text.fontSize = 52;
        text.characterSize = .012f;
        text.anchor = TextAnchor.UpperLeft;
        text.alignment = TextAlignment.Left;
        text.color = accent;
        return text;
    }

    void UpdatePhysicalReadouts()
    {
        if (routeReadout == null) return;
        routeReadout.text = "DU1  RUTA\n" + mission.RouteSegment + "\nNAVE  " + mission.CurrentBody + " / " + mission.OrbitalPosition + "\nSIG   " + mission.NextManeuver + "\nDIST  " + mission.DistanceToWaypointKm.ToString("0") + " km\nERR   " + mission.CourseErrorDeg.ToString("0.0") + "°\nDV    " + mission.RequiredDeltaV.ToString("0") + " m/s";
        flightReadout.text = "DU2  VUELO\n" + mission.LaunchState.ToString().ToUpper() + "  T-" + mission.CountdownSeconds.ToString("0") + "\nALT  " + mission.AltitudeKm.ToString("000.0") + " km\nVEL  " + mission.VelocityMs.ToString("0000") + " m/s\nACEL " + mission.AccelerationMs2.ToString("0.0") + " m/s²\nPITCH " + mission.Pitch.ToString("0.0") + "°  THR " + (mission.Throttle * 100).ToString("000") + "%\nDV    " + mission.DeltaVRemaining.ToString("0") + " m/s";
        systemsReadout.text = "DU3  SISTEMAS\nRS-25 " + (mission.LaunchState == LaunchVehicleState.Pad ? "ARMADOS" : "ACTIVOS") + "\nSRB   " + (mission.SRBsSeparated ? "SEPARADOS" : "ACTIVOS") + "\nCORE  " + (mission.CoreSeparated ? "SEPARADA" : "ACTIVA") + "\nICPS  " + (mission.Phase >= FlightPhase.ParkingOrbit ? "ACTIVO" : "EN ESPERA") + "\nORION " + mission.VehicleStage + "\nCOM   " + mission.Communications + "\nSEP   " + (mission.CanSeparateStage ? "AUTORIZADA" : "BLOQUEADA") + "\nTEMP  " + mission.TemperatureC.ToString("0") + " C  SEG " + mission.SafetyMargin.ToString("0") + "%";
    }

    void CreateExterior(Transform root)
    {
        Color metal = new Color(.42f, .45f, .5f), darkMetal = new Color(.1f, .13f, .17f);
        launchPadRoot = new GameObject("Earth launch pad").transform; launchPadRoot.SetParent(root, false);
        Part(launchPadRoot, "Terrain", new Vector3(0, -1.7f, 16), new Vector3(45, .3f, 45), new Color(.18f, .22f, .24f));
        Part(launchPadRoot, "Launch pad deck", new Vector3(0, -1.4f, 16), new Vector3(11, .4f, 11), darkMetal);
        Part(launchPadRoot, "Flame trench", new Vector3(0, -1.72f, 16), new Vector3(2.5f, .28f, 8.5f), new Color(.025f, .03f, .04f));
        Part(launchPadRoot, "Pad rail left", new Vector3(-2.35f, -1.08f, 16), new Vector3(.14f, .08f, 8.2f), metal);
        Part(launchPadRoot, "Pad rail right", new Vector3(2.35f, -1.08f, 16), new Vector3(.14f, .08f, 8.2f), metal);
        Part(launchPadRoot, "Flame trench lip left", new Vector3(-1.62f, -1.38f, 16), new Vector3(.2f, .22f, 9.2f), new Color(.16f, .18f, .22f));
        Part(launchPadRoot, "Flame trench lip right", new Vector3(1.62f, -1.38f, 16), new Vector3(.2f, .22f, 9.2f), new Color(.16f, .18f, .22f));
        for (int i = -4; i <= 4; i++) Part(launchPadRoot, "Pad tile", new Vector3(i * 1.08f, -1.17f, 18.8f), new Vector3(.9f, .04f, 2.15f), metal);
        // Pad details keep the launch view readable: rails, service boxes and guidance lights.
        for (int side = -1; side <= 1; side += 2)
        {
            Part(launchPadRoot, "Pad service gantry", new Vector3(side * 3.55f, -.55f, 16), new Vector3(.34f, 1.1f, 7.4f), darkMetal);
            Part(launchPadRoot, "Pad service spine", new Vector3(side * 3.55f, .25f, 16), new Vector3(.58f, .12f, 6.8f), metal);
        }
        for (int i = -3; i <= 3; i++)
        {
            GameObject marker = Part(launchPadRoot, "Pad guidance light", new Vector3(i * .95f, -1.03f, 20.65f), new Vector3(.12f, .045f, .18f), new Color(1f, .34f, .08f));
            SetEmission(marker, new Color(1f, .12f, .025f), .7f);
        }
        GameObject trenchGlow = Part(launchPadRoot, "Flame trench glow", new Vector3(0, -1.54f, 16), new Vector3(1.55f, .035f, 6.8f), new Color(.22f, .045f, .01f));
        SetEmission(trenchGlow, new Color(1f, .08f, .01f), .45f);
        rocketRoot = new GameObject("Launch vehicle").transform;
        rocketRoot.SetParent(root);
        // Align engine bells with deck top; avoid burying the fallback stack in pad.
        rocketRoot.position = new Vector3(0, 3.0f, 16);
        // Only use the SLS FBX and texture supplied in the user's ZIP.
        GameObject slsAsset = Resources.Load<GameObject>("NASA/Artemis2_reference");
        officialSlsTexture = Resources.Load<Texture2D>("NASA/Artemis2_SLS");
        if (slsAsset != null) slsVisual = InstantiateScaled(slsAsset, rocketRoot, "NASA SLS Block 1", 11f);
        ApplySlsTexture(slsVisual, officialSlsTexture);
        if (slsVisual != null && slsAsset != null && slsAsset.name == "Artemis2_reference")
            FlipImportedSlsToLaunchOrientation(slsVisual.transform, rocketRoot, 11f);
        // Leave the root empty when import fails; LaunchVehicleController builds its validated, separable stack.
        if (slsVisual == null) { slsVisual = new GameObject("Official SLS visual root"); slsVisual.transform.SetParent(rocketRoot); }
        orionVisual = new GameObject("Orion in flight"); orionVisual.transform.SetParent(rocketRoot); orionVisual.transform.localPosition = new Vector3(0, 4.1f, 0);
        GameObject orionAsset = Resources.Load<GameObject>("NASA/Orion_ArtemisII");
        GameObject importedOrion = orionAsset == null ? null : InstantiateScaled(orionAsset, orionVisual.transform, "NASA Orion capsule", 1.75f);
        if (importedOrion != null)
        {
            Transform[] panels = {
                FindDescendant(importedOrion.transform, "Cube.001"), FindDescendant(importedOrion.transform, "Cube.002"),
                FindDescendant(importedOrion.transform, "Cube.003"), FindDescendant(importedOrion.transform, "Cube.004")
            };
            if (panels[0] != null && panels[1] != null && panels[2] != null && panels[3] != null)
            {
                Transform left = new GameObject("SolarWing_Left").transform;
                Transform right = new GameObject("SolarWing_Right").transform;
                left.SetParent(importedOrion.transform, false); right.SetParent(importedOrion.transform, false);
                for (int i = 0; i < panels.Length; i++) panels[i].SetParent(i < 2 ? left : right, true);
            }
        }
        if (importedOrion == null) Sphere(orionVisual.transform, "Orion capsule fallback", new Vector3(0, .65f, 0), 1.25f, new Color(.84f, .86f, .9f));
        if (importedOrion == null || FindDescendant(importedOrion.transform, "ServiceModule") == null)
        {
            Transform serviceModule = new GameObject("ServiceModule").transform; serviceModule.SetParent(orionVisual.transform, false);
            Cylinder(serviceModule, "European service module", Vector3.zero, .43f, 1.05f, new Color(.62f, .65f, .68f), Vector3.zero);
        }
        if (importedOrion == null || FindDescendant(importedOrion.transform, "SolarWing_Left") == null || FindDescendant(importedOrion.transform, "SolarWing_Right") == null)
            for (int side = -1; side <= 1; side += 2)
            {
                string wingName = side < 0 ? "SolarWing_Left" : "SolarWing_Right";
                if (FindDescendant(importedOrion == null ? orionVisual.transform : importedOrion.transform, wingName) != null) continue;
                Transform wing = new GameObject(wingName).transform; wing.SetParent(orionVisual.transform); wing.localPosition = new Vector3(side * 1.35f, 0, 0);
                Part(wing, "Solar wing panel", Vector3.zero, new Vector3(1.65f, .04f, .58f), new Color(.025f, .1f, .28f));
            }
        landerVisual = new GameObject("Educational lunar lander"); landerVisual.transform.SetParent(rocketRoot); landerVisual.transform.localPosition = new Vector3(0, 4.1f, 0);
        Cylinder(landerVisual.transform, "Lander cabin", Vector3.zero, .48f, .95f, new Color(.7f, .69f, .58f), Vector3.zero);
        for (int side = -1; side <= 1; side += 2) for (int depth = -1; depth <= 1; depth += 2) Part(landerVisual.transform, "Landing leg", new Vector3(side * .65f, -.55f, depth * .65f), new Vector3(.07f, .85f, .07f), metal, new Vector3(side * 30, 0, depth * 30));
        vehicleController = gameObject.AddComponent<LaunchVehicleController>();
        CreateTower(root, new Vector3(-4.7f, 18f, 16));
        launchTower = root.Find("Mobile Launch Tower");
        vehicleController.Configure(rocketRoot, slsVisual, orionVisual, landerVisual, null);
        for (int i = -1; i <= 1; i += 2) for (int j = 0; j < 3; j++) Sphere(root, "Pad beacon", new Vector3(i * 4.4f, -.92f, 13.5f + j * 2.5f), .12f, new Color(1f, .24f, .08f));
        // A flattened sphere gives a curved, transparent atmospheric limb. Flat cubes
        // looked like hard blue strips in the exterior capture, especially in ascent.
        Transform curvedHorizon = Sphere(root, "Atmosphere curved horizon", new Vector3(0, 7f, 86f), 1f, new Color(.06f, .16f, .3f));
        // Keep limb narrow and low in frame. The former giant ellipse read as a
        // black rectangle and hid the vehicle during ascent.
        curvedHorizon.localPosition = new Vector3(0, -2.8f, 86f);
        curvedHorizon.localScale = new Vector3(105f, 11f, .24f);
        atmosphereHorizon = curvedHorizon.GetComponent<Renderer>();
        ConfigureAtmosphereRenderer(atmosphereHorizon, .45f);
        atmosphereMidHorizon = null;
        atmosphereUpperHorizon = null;
        atmosphereSpaceHorizon = null;
        CreateEarthBackdrop(root);
        lunarSurfaceRoot = CreateSurface(root, "Luna surface", new Color(.28f, .29f, .32f), new Color(.18f, .19f, .22f));
        marsSurfaceRoot = CreateSurface(root, "Mars surface", new Color(.38f, .12f, .055f), new Color(.24f, .07f, .035f));
        earthOceanRoot = new GameObject("Earth return ocean").transform; earthOceanRoot.SetParent(root, false);
        Part(earthOceanRoot, "Ocean", new Vector3(0, -1.72f, 16), new Vector3(55, .3f, 55), new Color(.035f, .14f, .28f));
        Part(earthOceanRoot, "Ocean horizon", new Vector3(0, -.9f, 25), new Vector3(55, 1.1f, .2f), new Color(.08f, .26f, .43f));
        for (int i = -5; i <= 5; i++)
        {
            GameObject wave = Part(earthOceanRoot, "Ocean wave", new Vector3(i * 4.7f, -1.45f, 18.5f + (i & 1) * 1.2f), new Vector3(1.6f, .025f, .06f), new Color(.16f, .38f, .54f));
            SetEmission(wave, new Color(.03f, .12f, .2f), .15f);
        }
        for (int i = 0; i < 80; i++) starRenderers.Add(Part(root, "Star", new Vector3(Mathf.Sin(i * 17.31f) * 55, Mathf.Cos(i * 41.17f) * 30 + 15, 72), Vector3.one * .16f, Color.white).GetComponent<Renderer>());
        SetLayerRecursively(root.gameObject, ExteriorLayer);
        launchPadRoot.gameObject.SetActive(true); lunarSurfaceRoot.gameObject.SetActive(false); marsSurfaceRoot.gameObject.SetActive(false); earthOceanRoot.gameObject.SetActive(false);
    }

    Transform CreateSurface(Transform root, string name, Color terrain, Color detail)
    {
        Transform surface = new GameObject(name).transform; surface.SetParent(root, false);
        Part(surface, name + " ground", new Vector3(0, -1.72f, 16), new Vector3(55, .3f, 55), terrain);
        for (int i = -3; i <= 3; i++) Part(surface, name + " ridge", new Vector3(i * 3.6f, -1.45f, 19 + Mathf.Abs(i) * 1.2f), new Vector3(1.2f, .22f, 2.8f), detail, new Vector3(0, i * 9f, i * 5f));
        bool mars = name.IndexOf("Mars", StringComparison.OrdinalIgnoreCase) >= 0;
        if (mars)
        {
            // Low dunes and scattered rocks give Mars a readable horizon without heavy terrain assets.
            for (int i = -4; i <= 4; i++)
            {
                Transform dune = Sphere(surface, "Mars dune", new Vector3(i * 3.3f, -1.18f + (i & 1) * .05f, 22f + Mathf.Abs(i % 3) * 1.4f), .9f, detail * .9f);
                dune.localScale = new Vector3(1.9f, .34f, 1.25f);
            }
            for (int i = 0; i < 7; i++)
            {
                float x = Mathf.Sin(i * 2.7f) * 10f, z = 17f + (i % 4) * 2.3f;
                Transform rock = Sphere(surface, "Mars rock", new Vector3(x, -1.1f, z), .18f + (i % 3) * .08f, detail * .8f);
                rock.localScale = new Vector3(1.35f, .7f, .95f);
            }
        }
        else
        {
            // Crater rims and floors read as lunar relief from the low surface camera.
            for (int i = -2; i <= 2; i++)
            {
                Vector3 position = new Vector3(i * 4.6f, -1.48f, 21f + (i & 1) * 1.8f);
                Cylinder(surface, "Luna crater rim", position, .85f + (i & 1) * .2f, .08f, detail, Vector3.zero);
                Cylinder(surface, "Luna crater floor", position + Vector3.down * .035f, .58f + (i & 1) * .12f, .035f, terrain * .72f, Vector3.zero);
            }
            for (int i = 0; i < 6; i++)
            {
                Transform rock = Sphere(surface, "Luna rock", new Vector3(Mathf.Cos(i * 1.9f) * 9f, -1.1f, 16.5f + (i % 3) * 2.2f), .16f + (i % 2) * .1f, detail);
                rock.localScale = new Vector3(1.2f, .75f, .9f);
            }
        }
        return surface;
    }

    void CreateEarthBackdrop(Transform root)
    {
        // Layered cloud banks replace the flat horizon while keeping draw cost tiny.
        earthBackdropRoot = new GameObject("Earth atmospheric backdrop").transform;
        earthBackdropRoot.SetParent(root, false);
        for (int i = -5; i <= 5; i++)
        {
            Transform cloud = Sphere(earthBackdropRoot, "Earth cloud bank", new Vector3(i * 5.8f, 5.2f + (i & 1) * 1.3f, 79.4f), 2.7f, new Color(.72f, .82f, .94f));
            cloud.localScale = new Vector3(2.8f, .42f, .16f);
            ConfigureAtmosphereRenderer(cloud.GetComponent<Renderer>(), .26f);
        }
        for (int i = -3; i <= 3; i++)
        {
            Transform haze = Sphere(earthBackdropRoot, "Earth haze layer", new Vector3(i * 9f, -1.1f, 79.1f), 3.4f, new Color(.18f, .37f, .58f));
            haze.localScale = new Vector3(2.5f, .18f, .12f);
            ConfigureAtmosphereRenderer(haze.GetComponent<Renderer>(), .18f);
        }
    }

    static void SetLayerRecursively(GameObject root, int layer)
    {
        root.layer = layer;
        foreach (Transform child in root.transform) SetLayerRecursively(child.gameObject, layer);
    }

    GameObject InstantiateScaled(GameObject source, Transform parent, string label, float height)
    {
        GameObject model = Instantiate(source, parent); model.name = label;
        Renderer[] renderers = model.GetComponentsInChildren<Renderer>(true);
        if (renderers.Length == 0) { Destroy(model); return null; }
        Renderer body = Array.Find(renderers, renderer => renderer.name.IndexOf("CrewModule_Body", StringComparison.OrdinalIgnoreCase) >= 0);
        Quaternion[] orientations = { Quaternion.identity, Quaternion.Euler(90, 0, 0), Quaternion.Euler(-90, 0, 0), Quaternion.Euler(0, 90, 0), Quaternion.Euler(0, -90, 0) };
        Quaternion bestOrientation = Quaternion.identity; Bounds bounds = new Bounds(); float bestRatio = float.MaxValue;
        foreach (Quaternion orientation in orientations)
        {
            model.transform.localRotation = orientation;
            Bounds candidate = body != null ? body.bounds : renderers[0].bounds;
            if (body == null) for (int i = 1; i < renderers.Length; i++) candidate.Encapsulate(renderers[i].bounds);
            float ratio = candidate.size.y < .001f ? float.MaxValue : Mathf.Max(candidate.size.x, candidate.size.z) / candidate.size.y;
            if (ratio < bestRatio) { bestRatio = ratio; bestOrientation = orientation; bounds = candidate; }
        }
        model.transform.localRotation = bestOrientation;
        foreach (Renderer renderer in renderers) { renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; renderer.receiveShadows = false; }
        // SLS NASA source is a monolithic launch silhouette; keep it even when
        // its single renderer is wider than the separable fallback hierarchy.
        bool allowMonolithicSls = label.IndexOf("SLS", StringComparison.OrdinalIgnoreCase) >= 0;
        if ((!allowMonolithicSls && bestRatio > .85f) || bounds.size.y < .001f || !IsFiniteBounds(bounds)) { Destroy(model); return null; }
        if (bounds.size.y > .001f)
        {
            model.transform.localScale *= height / bounds.size.y;
            bounds = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++) bounds.Encapsulate(renderers[i].bounds);
            // Align imported bounds to parent once; adding parent.position twice offsets the mesh.
            model.transform.position += new Vector3(parent.position.x - bounds.center.x, parent.position.y - height * .32f - bounds.min.y, parent.position.z - bounds.center.z);
        }
        return model;
    }

    static void FlipImportedSlsToLaunchOrientation(Transform model, Transform parent, float height)
    {
        model.Rotate(180f, 0f, 0f, Space.Self);
        // Imported reference is authored too narrow for the launch view.
        model.localScale = new Vector3(model.localScale.x * 1.55f, model.localScale.y, model.localScale.z * 1.55f);
        Renderer[] renderers = model.GetComponentsInChildren<Renderer>(true);
        if (renderers.Length == 0) return;
        Bounds bounds = renderers[0].bounds;
        for (int i = 1; i < renderers.Length; i++) bounds.Encapsulate(renderers[i].bounds);
        // Put engine skirt on pad plane. Do not leave imported mesh hovering.
        model.position += new Vector3(parent.position.x - bounds.center.x, parent.position.y - height * .38f - bounds.min.y, parent.position.z - bounds.center.z);
    }

    static void ApplySlsTexture(GameObject model, Texture2D texture)
    {
        if (model == null || texture == null) return;
        foreach (Renderer renderer in model.GetComponentsInChildren<Renderer>(true))
        {
            Material material = renderer.material;
            if (material.HasProperty("_BaseMap")) material.SetTexture("_BaseMap", texture);
            if (material.HasProperty("_MainTex")) material.SetTexture("_MainTex", texture);
            material.color = Color.white;
        }
    }

    static bool IsFiniteBounds(Bounds bounds)
    {
        Vector3 center = bounds.center, size = bounds.size;
        return IsFinite(center) && IsFinite(size) && size.x > .001f && size.y > .001f && size.z > .001f;
    }

    static bool IsFinite(Vector3 value) => IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
    static bool IsFinite(float value) => !float.IsNaN(value) && !float.IsInfinity(value);

    static Transform FindDescendant(Transform root, string name)
    {
        if (root == null) return null;
        foreach (Transform child in root)
        {
            if (child.name == name) return child;
            Transform match = FindDescendant(child, name);
            if (match != null) return match;
        }
        return null;
    }

    void CreateLaunchVehicle(Transform root)
    {
        Color core = new Color(.76f, .78f, .82f), booster = new Color(.9f, .89f, .84f), orange = new Color(.82f, .34f, .09f), dark = new Color(.12f, .14f, .17f), black = new Color(.025f, .03f, .04f);
        Transform coreStage = new GameObject("CoreStage").transform; coreStage.SetParent(root); coreStage.localPosition = Vector3.zero;
        Cylinder(coreStage, "Orange core tank", new Vector3(0, -.05f, 0), .56f, 6.55f, orange, Vector3.zero);
        Cylinder(coreStage, "Aft engine skirt", new Vector3(0, -3.35f, 0), .68f, .46f, dark, Vector3.zero);
        Cylinder(coreStage, "Intertank band", new Vector3(0, .62f, 0), .585f, .18f, new Color(.68f, .25f, .07f), Vector3.zero);
        Cylinder(coreStage, "Upper orange band", new Vector3(0, 2.55f, 0), .59f, .12f, new Color(.96f, .52f, .12f), Vector3.zero);
        Part(coreStage, "USA flag panel", new Vector3(0, -.7f, -.58f), new Vector3(.4f, .34f, .025f), new Color(.08f, .2f, .48f));
        Cylinder(coreStage, "Forward skirt", new Vector3(0, 3.38f, 0), .62f, .38f, dark, Vector3.zero);
        Cylinder(coreStage, "Interstage", new Vector3(0, 3.77f, 0), .62f, .55f, dark, Vector3.zero);
        Transform icps = new GameObject("ICPS").transform; icps.SetParent(root); icps.localPosition = Vector3.zero;
        Cylinder(icps, "Upper stage", new Vector3(0, 4.43f, 0), .43f, 1.25f, core, Vector3.zero);
        Cylinder(icps, "ICPS engine skirt", new Vector3(0, 3.78f, 0), .5f, .22f, dark, Vector3.zero);
        Transform orion = new GameObject("OrionStack").transform; orion.SetParent(root); orion.localPosition = Vector3.zero;
        Cylinder(orion, "Orion service module", new Vector3(0, 5.32f, 0), .47f, .55f, new Color(.62f, .65f, .68f), Vector3.zero);
        Sphere(orion, "Orion crew module", new Vector3(0, 5.84f, 0), .72f, new Color(.88f, .9f, .92f));
        Cylinder(orion, "Launch escape tower", new Vector3(0, 6.62f, 0), .08f, 1.05f, dark, Vector3.zero);
        for (int side = -1; side <= 1; side += 2) Part(orion, "LAS abort arm", new Vector3(side * .2f, 6.38f, 0), new Vector3(.08f, .48f, .08f), dark, new Vector3(0, 0, side * 28));
        for (int side = -1; side <= 1; side += 2)
        {
            Transform srb = new GameObject(side < 0 ? "SRB_Left" : "SRB_Right").transform; srb.SetParent(root); srb.localPosition = new Vector3(side * .94f, 0, 0);
            Cylinder(srb, "Solid booster", new Vector3(0, -.12f, 0), .32f, 5.8f, booster, Vector3.zero);
            Cylinder(srb, "Booster aft skirt", new Vector3(0, -3.08f, 0), .4f, .38f, dark, Vector3.zero);
            Sphere(srb, "Booster nose", new Vector3(0, 2.82f, 0), .36f, booster);
            Cylinder(srb, "Booster engine", new Vector3(0, -3.32f, 0), .18f, .45f, dark, Vector3.zero);
            Part(srb, "Booster separation stripe", new Vector3(0, .72f, -.33f), new Vector3(.3f, .12f, .025f), black);
            Part(srb, "NASA red marking", new Vector3(0, 1.22f, -.335f), new Vector3(.31f, .44f, .025f), new Color(.72f, .05f, .04f));
            VehicleMarking(srb, "NASA", new Vector3(0, 1.22f, -.36f), 16, Color.white);
        }
        for (int x = -1; x <= 1; x++) Cylinder(coreStage, "RS-25 engine", new Vector3(x * .24f, -3.48f, 0), .15f, .42f, dark, Vector3.zero);
        Part(coreStage, "United States marking", new Vector3(0, .5f, -.58f), new Vector3(.44f, 1.15f, .025f), new Color(.08f, .22f, .48f));
    }

    void CreateTower(Transform root, Vector3 position)
    {
        Color tower = new Color(.18f, .23f, .3f);
        Transform mobile = new GameObject("Mobile Launch Tower").transform; mobile.SetParent(root); mobile.position = position;
        const float towerHeight = 28f;
        for (int side = -1; side <= 1; side += 2)
            for (int depth = -1; depth <= 1; depth += 2)
                Part(mobile, "Tower column", new Vector3(side * .82f, 0, depth * .5f), new Vector3(.22f, towerHeight, .18f), tower);
        for (int level = -12; level <= 12; level++)
        {
            float y = level * 1.12f;
            for (int depth = -1; depth <= 1; depth += 2)
            {
                Part(mobile, "Tower crossbeam", new Vector3(0, y, depth * .5f), new Vector3(1.95f, .12f, .12f), tower);
                Part(mobile, "Tower brace", new Vector3(0, y + .45f, depth * .5f), new Vector3(2.25f, .1f, .1f), tower, new Vector3(0, 0, level % 2 == 0 ? 35 : -35));
            }
        }
        Part(mobile, "Crew access arm", new Vector3(2.0f, 8.0f, 0), new Vector3(2.7f, .18f, .42f), tower);
        Part(mobile, "Crew access white end", new Vector3(3.22f, 8.0f, 0), new Vector3(.3f, .38f, .52f), new Color(.72f, .76f, .8f));
    }

    void CreateRoute(Transform root)
    {
        Sphere(root, "Sun", Vector3.zero, 2.2f, new Color(1f, .62f, .12f));
        Orbit(root, 6, new Color(.15f, .45f, .85f)); Orbit(root, 10, new Color(.7f, .74f, .8f)); Orbit(root, 15, new Color(.8f, .28f, .15f));
        Sphere(root, "Earth", new Vector3(6, 0, 0), .75f, new Color(.12f, .42f, .88f)); Sphere(root, "Moon", new Vector3(7.2f, .2f, 0), .2f, new Color(.72f, .72f, .68f));
        Sphere(root, "Mars", new Vector3(-15, 0, 0), .58f, new Color(.78f, .24f, .1f)); routeShip = Sphere(root, "Ship", new Vector3(4.3f, .7f, 0), .16f, new Color(.2f, 1f, .85f));
    }

    void Orbit(Transform root, float radius, Color color) { for (int i = 0; i < 72; i++) { float angle = i * Mathf.PI * 2 / 72; Part(root, "Orbit", new Vector3(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius, 0), new Vector3(.12f, .12f, .06f), color); } }
    GameObject Part(Transform parent, string label, Vector3 position, Vector3 scale, Color color) => Part(parent, label, position, scale, color, Vector3.zero);
    GameObject Part(Transform parent, string label, Vector3 position, Vector3 scale, Color color, Vector3 rotation) { GameObject part = GameObject.CreatePrimitive(PrimitiveType.Cube); part.name = label; part.transform.SetParent(parent); part.transform.localPosition = position; part.transform.localRotation = Quaternion.Euler(rotation); part.transform.localScale = scale; Renderer renderer = part.GetComponent<Renderer>(); renderer.material.color = color; renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; renderer.receiveShadows = false; return part; }
    void SetEmission(GameObject part, Color color, float intensity) { if (part == null) return; Material material = part.GetComponent<Renderer>()?.material; if (material == null) return; material.SetColor("_EmissionColor", color * intensity); material.EnableKeyword("_EMISSION"); }
    void VehicleMarking(Transform parent, string value, Vector3 position, int size, Color color) { GameObject go = new GameObject(value + " marking"); go.transform.SetParent(parent); go.transform.localPosition = position; go.transform.localRotation = Quaternion.Euler(0, 180, 0); TextMesh text = go.AddComponent<TextMesh>(); text.text = value; text.fontSize = size; text.characterSize = .012f; text.anchor = TextAnchor.MiddleCenter; text.alignment = TextAlignment.Center; text.color = color; }
    GameObject ScreenPart(Transform parent, string label, Vector3 position, Vector3 scale, Color accent, Vector3 rotation) { GameObject part = Part(parent, label, position, scale, new Color(.006f, .018f, .027f), rotation); Material material = part.GetComponent<Renderer>().material; material.SetColor("_EmissionColor", accent * .22f); material.EnableKeyword("_EMISSION"); material.SetFloat("_Metallic", .22f); material.SetFloat("_Glossiness", .78f); return part; }
    GameObject Cylinder(Transform parent, string label, Vector3 position, float radius, float depth, Color color, Vector3 rotation) { GameObject part = GameObject.CreatePrimitive(PrimitiveType.Cylinder); part.name = label; part.transform.SetParent(parent); part.transform.localPosition = position; part.transform.localRotation = Quaternion.Euler(rotation); part.transform.localScale = new Vector3(radius * 2, depth * .5f, radius * 2); Renderer renderer = part.GetComponent<Renderer>(); renderer.material.color = color; renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; renderer.receiveShadows = false; return part; }
    Transform Sphere(Transform parent, string label, Vector3 position, float scale, Color color) { GameObject part = GameObject.CreatePrimitive(PrimitiveType.Sphere); part.name = label; part.transform.SetParent(parent); part.transform.localPosition = position; part.transform.localScale = Vector3.one * scale; Renderer renderer = part.GetComponent<Renderer>(); renderer.material.color = color; renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; renderer.receiveShadows = false; return part.transform; }

    void UpdateRouteVisual()
    {
        if (routeShip == null) return;
        float progress = Mathf.Clamp01(mission.ProgressPercent / 100f);
        Vector3 earth = new Vector3(6, 0, 0), moon = new Vector3(7.2f, .2f, 0), mars = new Vector3(-15, 0, 0);
        Vector3 target = mission.Profile == MissionProfile.MarsMission ? mars : moon;
        Vector3 start = mission.CurrentBody == "TIERRA" ? earth : target;
        float t = mission.CurrentBody == "TIERRA" ? progress : 1f - progress;
        Vector3 point = Vector3.Lerp(start, target, t);
        point.y += Mathf.Sin(t * Mathf.PI) * (mission.Profile == MissionProfile.MarsMission ? 2.1f : 1.15f);
        routeShip.localPosition = point;
    }

    void UpdateWindowCamera()
    {
        if (windowCamera == null) return;
        Vector3 target = vehicleController != null ? vehicleController.CameraTarget : new Vector3(0, .72f, 16f);
        Quaternion look = Quaternion.Euler(pitch - 3f, yaw, 0);
        windowCamera.transform.position = target - look * Vector3.forward * .4f;
        windowCamera.transform.rotation = look;
        // Window and Exterior consume the same resolved environmental snapshot.
        windowCamera.backgroundColor = environmentSkyColor;
        UpdateAtmosphereBands();
    }

    void UpdateExteriorEnvironment()
    {
        if (mission == null) return;
        // Keep ground detail only while close enough to read it. The vehicle owns the
        // actual climb; this prevents a launch deck from following it into space.
        bool earthPad = mission.CurrentBody == "TIERRA" && mission.AltitudeKm < 4f && mission.Phase <= FlightPhase.Ascent;
        bool earthReturn = mission.CurrentBody == "TIERRA" && mission.Phase >= FlightPhase.Return;
        bool lunarSurface = mission.CurrentBody == "LUNA" && (mission.Phase == FlightPhase.Descent || mission.Phase == FlightPhase.Surface);
        // Keep final Mars frame on the landing site instead of returning to empty space.
        bool marsSurface = mission.CurrentBody == "MARTE" && (mission.Phase == FlightPhase.Descent || mission.Phase == FlightPhase.Surface || mission.Phase == FlightPhase.Complete);
        if (!atmosphereColorReady) { renderedAtmosphereColor = mission.AtmosphereColor; atmosphereColorReady = true; }
        float blend = 1f - Mathf.Exp(-Time.deltaTime * 4.5f);
        renderedAtmosphereColor = Color.Lerp(renderedAtmosphereColor, mission.AtmosphereColor, blend);
        environmentSkyColor = renderedAtmosphereColor;
        environmentStarsVisible = mission.CurrentBody == "LUNA" || mission.AltitudeKm >= 50f;
        environmentSnapshot = new EnvironmentSnapshot {
            body = mission.CurrentBody,
            atmosphere = mission.AtmosphereName,
            altitudeKm = mission.AltitudeKm,
            sky = environmentSkyColor,
            stars = environmentStarsVisible,
            clouds = mission.CurrentBody == "TIERRA" && mission.AltitudeKm < 42f
        };
        if (environmentSnapshot.stars && vehicleController != null)
        {
            Vector3 starCenter = vehicleController.CameraTarget;
            for (int i = 0; i < starRenderers.Count; i++)
            {
                float a = i * 17.31f;
                float b = i * 41.17f;
                starRenderers[i].transform.position = starCenter + new Vector3(Mathf.Sin(a) * 55f, Mathf.Cos(b) * 30f + 15f, 70f + Mathf.Sin(a * .7f) * 18f);
            }
        }
        if (launchPadRoot != null) launchPadRoot.gameObject.SetActive(earthPad);
        // The tower is a ground asset, not an orbital prop. Hide it after clearance.
        if (launchTower != null)
        {
            bool towerVisible = earthPad || (mission.Phase == FlightPhase.Launch && mission.AltitudeKm < 2f) || (mission.Phase == FlightPhase.Ascent && mission.AltitudeKm < 12f);
            launchTower.gameObject.SetActive(towerVisible);
        }
        // Clouds and low-altitude haze must leave frame before the vehicle reaches space.
        if (earthBackdropRoot != null)
        {
            bool showClouds = environmentSnapshot.clouds;
            earthBackdropRoot.gameObject.SetActive(showClouds);
            if (showClouds) earthBackdropRoot.localPosition = new Vector3(Mathf.Sin(Time.time * .035f) * 1.7f, Mathf.Sin(Time.time * .015f) * .18f, 0);
        }
        if (earthOceanRoot != null) earthOceanRoot.gameObject.SetActive(earthReturn);
        if (lunarSurfaceRoot != null) lunarSurfaceRoot.gameObject.SetActive(lunarSurface);
        if (marsSurfaceRoot != null) marsSurfaceRoot.gameObject.SetActive(marsSurface);
    }

    void UpdateCamera()
    {
        if (view == ViewMode.Cockpit)
        {
            Vector3 shake = Vector3.zero;
            bool poweredFlight = mission.LaunchState >= LaunchVehicleState.Ignition && mission.LaunchState <= LaunchVehicleState.Ascent;
            if (poweredFlight && !mission.IsComplete)
            {
                float pressureFactor = Mathf.Clamp01(mission.DynamicPressureKpa / 80f);
                cabinShake = Mathf.MoveTowards(cabinShake, .006f + pressureFactor * .018f, Time.deltaTime * .03f);
                float t = Time.time;
                shake = new Vector3(Mathf.Sin(t * 31f) * cabinShake, Mathf.Cos(t * 43f) * cabinShake * .7f, Mathf.Sin(t * 23f) * cabinShake * .35f);
            }
            else cabinShake = Mathf.MoveTowards(cabinShake, 0, Time.deltaTime * .05f);
            if (focus == CockpitFocus.Overview) { simulatorCamera.transform.position = new Vector3(0, -.05f, -.6f) + shake; simulatorCamera.transform.rotation = Quaternion.Euler(pitch - 3, yaw, 0); simulatorCamera.fieldOfView = 62f; }
            else { Vector3 target = displays[(int)focus - 1].position; simulatorCamera.transform.position = new Vector3(target.x * .43f, target.y + .15f, .35f) + shake; simulatorCamera.transform.rotation = Quaternion.LookRotation(target - simulatorCamera.transform.position); simulatorCamera.fieldOfView = 53f; }
        }
        else if (view == ViewMode.Exterior)
        {
            Vector3 target = vehicleController != null ? vehicleController.CameraTarget : (rocketRoot != null ? rocketRoot.position + Vector3.up * 1.5f : new Vector3(0, 2, 16));
            float radius = vehicleController != null ? vehicleController.VisualRadius : 8f;
            bool phaseChanged = exteriorPhaseCache != mission.Phase || exteriorLaunchStateCache != mission.LaunchState;
            // Stage swaps can leave bounds empty for one frame. Keep camera on vehicle root.
            if (rocketRoot != null && (!IsFinite(target) || Mathf.Abs(target.y - rocketRoot.position.y) > Mathf.Max(radius * 3f, 24f)))
                target = rocketRoot.position + Vector3.up * Mathf.Clamp(radius * .25f, 1.5f, 8f);
            float aspect = Screen.height > 0 ? (float)Screen.width / Screen.height : 1.777f;
            float narrowCompensation = Mathf.Clamp(1.777f / aspect, 1f, 1.8f);
            bool separation = mission.LaunchState == LaunchVehicleState.SRBSeparation || mission.LaunchState == LaunchVehicleState.CoreSeparation;
            bool orbital = mission.Phase >= FlightPhase.ParkingOrbit && mission.Phase < FlightPhase.Descent;
            bool surface = mission.Phase == FlightPhase.Descent || mission.Phase == FlightPhase.Surface;
            // Launch framing must include the full stack. The old close preset
            // clipped the escape tower while the vehicle was still on screen.
            float framing = separation ? 3.0f : surface ? 2.0f : orbital ? 2.5f : 3.8f;
            float distance = Mathf.Clamp(radius * framing, 16f, separation ? 56f : 70f) * narrowCompensation / exteriorZoom;
            bool poweredAscent = mission.Phase <= FlightPhase.Ascent;
            // During launch lock to RocketRoot. Bounds shift when pieces toggle and made
            // the camera drift or lose the vehicle during liftoff.
            if (poweredAscent && rocketRoot != null)
            {
                target = rocketRoot.position + Vector3.up * Mathf.Clamp(radius * .25f, 2f, 8f);
            }
            float ascentSpeed = mission == null ? 0f : mission.VerticalVelocityMs;
            if (poweredAscent)
            {
                exteriorLookTarget = target;
                exteriorTargetVelocity = Vector3.zero;
            }
            else
            {
                exteriorLookTarget = Vector3.SmoothDamp(exteriorLookTarget, target, ref exteriorTargetVelocity, .12f);
                if (Vector3.Distance(exteriorLookTarget, target) > radius * .7f)
                {
                    exteriorLookTarget = target;
                    exteriorTargetVelocity = Vector3.zero;
                }
            }
            // Keep SLS below centre during ascent so horizon and altitude change remain visible.
            float lateralView = separation ? .45f : surface ? .5f : orbital ? .75f : .28f;
            float verticalOffset = poweredAscent ? distance * .12f : distance * (surface ? .2f : .34f);
            bool snap = !exteriorCameraInitialized || phaseChanged;
            Vector3 desiredTarget = snap ? target : exteriorLookTarget;
            Vector3 defaultOffset = new Vector3(distance * lateralView, verticalOffset, -distance * (orbital ? 1.05f : .9f));
            Vector3 desired = desiredTarget + Quaternion.Euler(exteriorOrbitPitch, exteriorOrbitYaw, 0f) * defaultOffset;
            if (snap)
            {
                exteriorLookTarget = target;
                simulatorCamera.transform.position = desired;
                exteriorTargetVelocity = Vector3.zero;
                cameraVelocity = Vector3.zero;
            }
            else
            {
                float cameraSmooth = poweredAscent ? Mathf.Lerp(.045f, .012f, Mathf.InverseLerp(0f, 600f, ascentSpeed)) : .12f;
                simulatorCamera.transform.position = Vector3.SmoothDamp(simulatorCamera.transform.position, desired, ref cameraVelocity, cameraSmooth);
                if (Vector3.Distance(simulatorCamera.transform.position, desired) > radius * 1.4f)
                {
                    simulatorCamera.transform.position = desired;
                    cameraVelocity = Vector3.zero;
                }
            }
            simulatorCamera.transform.rotation = Quaternion.LookRotation(exteriorLookTarget - simulatorCamera.transform.position);
            simulatorCamera.fieldOfView = separation ? 64f : mission.Phase <= FlightPhase.Ascent ? 62f : 62f;
            simulatorCamera.farClipPlane = Mathf.Max(200000f, Mathf.Abs(simulatorCamera.transform.position.y) + distance * 4f);
            exteriorCameraInitialized = true;
            exteriorPhaseCache = mission.Phase;
            exteriorLaunchStateCache = mission.LaunchState;
        }
        else { cameraVelocity = Vector3.zero; simulatorCamera.transform.position = new Vector3(0, 0, -28f / routeZoom); simulatorCamera.transform.rotation = Quaternion.identity; simulatorCamera.fieldOfView = 62f; }
        simulatorCamera.backgroundColor = view == ViewMode.Route ? new Color(.008f, .012f, .025f) : environmentSkyColor;
    }

    void UpdateAtmosphereBands()
    {
        float altitude = Mathf.Clamp(environmentSnapshot.altitudeKm, 0, 160);
        Color ground = renderedAtmosphereColor;
        Color space = new Color(.002f, .004f, .012f);
        bool atmosphericBody = environmentSnapshot.body != "LUNA";
        float horizonFade = atmosphericBody ? 1f - Mathf.InverseLerp(24f, 145f, altitude) : 0f;
        bool showBands = atmosphericBody && horizonFade > .01f;
        bool showStars = environmentStarsVisible;
        Color lower = Color.Lerp(space, ground, horizonFade);
        Color middle = Color.Lerp(space, ground, horizonFade * .62f);
        Color upper = Color.Lerp(space, ground, horizonFade * .28f);
        // Use overlapping low-contrast layers only near the atmosphere. This prevents the
        // large rectangular planes from reading as blue stripes once the rocket is high.
        // Background color plus cloud banks provide the atmospheric limb. The old
        // flattened sphere produced a visible oval and obscured the vehicle.
        if (atmosphereHorizon != null) { atmosphereHorizon.enabled = false; SetAtmosphereColor(atmosphereHorizon, lower, .08f * horizonFade); }
        if (atmosphereMidHorizon != null) { atmosphereMidHorizon.enabled = showBands && altitude < 82f; SetAtmosphereColor(atmosphereMidHorizon, middle, .28f * horizonFade); }
        if (atmosphereUpperHorizon != null) { atmosphereUpperHorizon.enabled = showBands && altitude < 52f; SetAtmosphereColor(atmosphereUpperHorizon, upper, .18f * horizonFade); }
        if (atmosphereSpaceHorizon != null) { atmosphereSpaceHorizon.enabled = showBands && altitude > 92f && altitude < 145f; SetAtmosphereColor(atmosphereSpaceHorizon, space, .14f * horizonFade); }
        for (int i = 0; i < starRenderers.Count; i++) starRenderers[i].enabled = showStars;
    }

    void CreateStyles()
    {
        titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold, normal = { textColor = new Color(.55f, .9f, 1f) } };
        textStyle = new GUIStyle(GUI.skin.label) { fontSize = 16, wordWrap = true, normal = { textColor = new Color(.8f, .88f, .95f) } };
        valueStyle = new GUIStyle(textStyle) { fontSize = 25, fontStyle = FontStyle.Bold, normal = { textColor = new Color(.3f, 1f, .8f) } };
        buttonStyle = new GUIStyle(GUI.skin.label) { fontSize = 14, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(.84f, .93f, 1f) } };
    }

    void OnGUI()
    {
        if (titleStyle == null) CreateStyles();
        if (missionMenu) { MissionMenu(); return; }
        TopBar(); if (view == ViewMode.Cockpit && focus != CockpitFocus.Overview && UiButton(new Rect(24, 190, 180, 32), "VOLVER A CABINA · ESC", new Color(.07f, .12f, .19f))) focus = CockpitFocus.Overview; if (view == ViewMode.Route) { RouteLegend(); NavigationControls(); } if (view == ViewMode.Cockpit && focus == CockpitFocus.Route) NavigationControls(); if (view == ViewMode.Exterior) ExteriorControls(); if (mission.HasPendingQuiz) QuizModal(); if (mission.IsComplete) SummaryModal(); if (tutorial) Tutorial(); if (paused) PauseModal();
    }

    void TopBar()
    {
        float barWidth = Mathf.Min(570f, Screen.width - 28f);
        Rect telemetry = new Rect(14, 14, barWidth, 122); Panel(telemetry, new Color(.12f, .72f, 1f));
        float contentWidth = Mathf.Max(120f, barWidth - 40f);
        GUI.Label(new Rect(28, 20, contentWidth, 25), "CISLUNAR JUNIOR  //  " + mission.Vehicle, titleStyle);
        GUI.Label(new Rect(28, 49, contentWidth, 18), mission.MissionName + "  ·  " + mission.Phase.ToString().ToUpper() + "  ·  " + mission.LaunchState.ToString().ToUpper() + "  ·  " + (mission.FreeFlight ? "VUELO LIBRE" : "MODO MISIÓN"), textStyle);
        float metricWidth = Mathf.Max(72f, (contentWidth - 12f) / 3f);
        GUI.Label(new Rect(28, 73, metricWidth, 26), mission.AltitudeKm.ToString("0.0") + " km", valueStyle); GUI.Label(new Rect(28 + metricWidth + 6f, 73, metricWidth, 26), mission.VelocityMs.ToString("0") + " m/s", valueStyle); GUI.Label(new Rect(28 + (metricWidth + 6f) * 2f, 73, metricWidth, 26), mission.FuelPercent.ToString("0") + "% COMB", valueStyle);
        GUI.Label(new Rect(28, 101, contentWidth, 18), "ENTORNO  " + mission.CurrentBody + " · " + mission.AtmosphereName + " · Q " + mission.DynamicPressureKpa.ToString("0.0") + " kPa", textStyle);
        string[] labels = { "CABINA", "EXTERIOR", "RUTA", "INSTRUMENTOS" }; float navGap = 6f, navWidth = Mathf.Max(74f, (Screen.width - 48f - navGap * 3f) / 4f); for (int i = 0; i < labels.Length; i++) if (UiButton(new Rect(16 + i * (navWidth + navGap), 148, navWidth, 34), labels[i], (i == 3 ? focus != CockpitFocus.Overview && view == ViewMode.Cockpit : (ViewMode)i == view) ? new Color(.08f, .54f, .8f) : new Color(.07f, .12f, .19f))) { if (i == 3) Focus(CockpitFocus.Flight); else { SetView((ViewMode)i); if (i == 0) focus = CockpitFocus.Overview; } }
        GUI.Label(new Rect(600, 20, Mathf.Max(260, Screen.width - 620), 42), mission.LearningObjective + "  PUNTOS " + mission.Score + " · PROGRESO " + mission.ProgressPercent + "%", textStyle);
    }

    void QuizModal()
    {
        Rect rect = new Rect(Screen.width * .5f - 245, Screen.height * .5f - 110, 490, 220);
        GUI.Box(rect, GUIContent.none);
        GUI.Label(new Rect(rect.x + 22, rect.y + 18, 440, 28), mission.QuizTitle, titleStyle);
        GUI.Label(new Rect(rect.x + 22, rect.y + 54, 440, 50), mission.QuizQuestion, textStyle);
        if (GUI.Button(new Rect(rect.x + 22, rect.y + 124, 210, 34), "A · " + mission.QuizOptionA, buttonStyle)) mission.SubmitQuiz(true);
        if (GUI.Button(new Rect(rect.x + 258, rect.y + 124, 210, 34), "B · " + mission.QuizOptionB, buttonStyle)) mission.SubmitQuiz(false);
        GUI.Label(new Rect(rect.x + 22, rect.y + 172, 440, 25), mission.StatusMessage, textStyle);
    }
    void MissionMenu() { Rect rect = new Rect(Screen.width * .5f - 300, Screen.height * .5f - 190, 600, 380); Panel(rect, new Color(.15f, .74f, 1f)); GUI.Label(new Rect(rect.x + 30, rect.y + 25, 540, 32), "SELECCIÓN DE MISIÓN", titleStyle); GUI.Label(new Rect(rect.x + 30, rect.y + 62, 540, 20), "CISLUNAR JUNIOR · SIMULADOR STEM", textStyle); GUI.Label(new Rect(rect.x + 30, rect.y + 95, 540, 45), "Cada perfil combina telemetría, control de nave y preguntas de ciencia para avanzar.", textStyle); if (UiButton(new Rect(rect.x + 30, rect.y + 156, 540, 42), "01  ·  ARTEMIS II EXTENDIDA   /   TIERRA → LUNA", new Color(.05f, .26f, .42f))) StartMission(MissionProfile.ArtemisIIExtended); if (UiButton(new Rect(rect.x + 30, rect.y + 210, 540, 42), "02  ·  ALUNIZAJE   /   DESCENSO Y RETORNO", new Color(.13f, .2f, .32f))) StartMission(MissionProfile.LunarLanding); if (UiButton(new Rect(rect.x + 30, rect.y + 264, 540, 42), "03  ·  MARTE   /   TRANSFERENCIA Y ATERRIZAJE", new Color(.32f, .14f, .1f))) StartMission(MissionProfile.MarsMission); GUI.Label(new Rect(rect.x + 30, rect.y + 333, 540, 22), "H  ayuda  ·  P  pausa  ·  Tab  cambiar vista", textStyle); }
    void PauseModal() { Rect rect = new Rect(Screen.width * .5f - 160, Screen.height * .5f - 70, 320, 140); GUI.Box(rect, GUIContent.none); GUI.Label(new Rect(rect.x + 24, rect.y + 22, 270, 28), "SIMULACIÓN EN PAUSA", titleStyle); GUI.Label(new Rect(rect.x + 24, rect.y + 56, 270, 22), "P o Esc para continuar.", textStyle); if (GUI.Button(new Rect(rect.x + 24, rect.y + 90, 130, 28), "REANUDAR", buttonStyle)) paused = false; if (GUI.Button(new Rect(rect.x + 166, rect.y + 90, 130, 28), "MENÚ", buttonStyle)) missionMenu = true; }
    void SummaryModal() { Rect rect = new Rect(Screen.width * .5f - 245, Screen.height * .5f - 100, 490, 200); GUI.Box(rect, GUIContent.none); GUI.Label(new Rect(rect.x + 22, rect.y + 20, 440, 28), "MISIÓN COMPLETADA", titleStyle); GUI.Label(new Rect(rect.x + 22, rect.y + 60, 440, 64), "Perfil: " + mission.MissionName + "\nPuntuación STEM: " + mission.Score + "\nConceptos: empuje, velocidad orbital, transferencia y descenso.", textStyle); if (GUI.Button(new Rect(rect.x + 22, rect.y + 146, 180, 30), "REINICIAR MISIÓN", buttonStyle)) StartMission(mission.Profile); }
    void RouteLegend() { GUI.Box(new Rect(24, Screen.height - 174, 460, 144), GUIContent.none); GUI.Label(new Rect(40, Screen.height - 166, 420, 22), "MAPA HELIOCÉNTRICO · ESCALA ESQUEMÁTICA", titleStyle); GUI.Label(new Rect(40, Screen.height - 136, 420, 74), "Sol: naranja · Tierra: azul · Luna: gris · Marte: rojo · Nave: verde\nSEGMENTO: " + mission.RouteSegment + "\nSIGUIENTE: " + mission.NextManeuver + " · DIST: " + mission.DistanceToWaypointKm.ToString("0") + " km\nRUTA: " + mission.CourseErrorDeg.ToString("0.0") + "° error · zoom rueda / +/-", textStyle); }
    void NavigationControls() { Rect rect = new Rect(Screen.width - 300, Screen.height - 174, 276, 144); Panel(rect, new Color(.2f, .8f, .65f)); GUI.Label(new Rect(rect.x + 14, rect.y + 10, 246, 22), "NAVEGACIÓN ASISTIDA STEM", titleStyle); GUI.Label(new Rect(rect.x + 14, rect.y + 36, 246, 20), mission.ManeuverReady ? "VENTANA DE MANIOBRA ABIERTA" : "ESPERA VENTANA / HITO", textStyle); if (UiButton(new Rect(rect.x + 14, rect.y + 64, 246, 30), "EJECUTAR MANIOBRA", mission.ManeuverReady ? new Color(.05f, .42f, .3f) : new Color(.08f, .12f, .16f)) && mission.ManeuverReady) mission.TryExecuteNextManeuver(); if (UiButton(new Rect(rect.x + 14, rect.y + 102, 246, 30), "CORREGIR RUTA", mission.CourseErrorDeg >= 1.5f ? new Color(.42f, .28f, .08f) : new Color(.08f, .12f, .16f)) && mission.CourseErrorDeg >= 1.5f) mission.TryCorrectCourse(); }
    void ExteriorControls()
    {
        Rect rect = new Rect(Mathf.Max(12, Screen.width - 360), 238, 340, 374);
        Panel(rect, new Color(.15f, .72f, 1f));
        float width = rect.width - 28;
        GUI.Label(new Rect(rect.x + 14, rect.y + 10, width, 26), "CONTROL EXTERIOR", titleStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 42, width, 20), "FASE     " + mission.LaunchState.ToString().ToUpper(), textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 64, width, 20), "CUERPO   " + mission.CurrentBody + " · " + mission.AtmosphereName, textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 86, width, 20), "ALT      " + mission.AltitudeKm.ToString("0.0") + " km", textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 108, width, 20), "VEL      " + mission.VelocityMs.ToString("0") + " m/s", textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 130, width, 20), "Q        " + mission.DynamicPressureKpa.ToString("0.0") + " kPa", textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 152, width, 20), "COMB     " + mission.FuelPercent.ToString("0") + "%", textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 174, width, 20), "MOTOR    " + (mission.LaunchState == LaunchVehicleState.Ignition || mission.LaunchState == LaunchVehicleState.Liftoff || mission.LaunchState == LaunchVehicleState.Ascent || mission.LaunchState == LaunchVehicleState.SRBSeparation || mission.LaunchState == LaunchVehicleState.ICPSBurn ? "ENCENDIDO" : "EN ESPERA"), textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 196, width, 20), "SIGUIENTE " + mission.NextManeuver, textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 218, width, 36), mission.Phase == FlightPhase.Pad && !mission.LaunchRequested ? "LISTO    PULSA INICIAR DESPEGUE" : mission.CountdownSeconds > 0 ? "CUENTA    T-" + mission.CountdownSeconds.ToString("0.0") : mission.StatusMessage, textStyle);
        string lockState = mission.HasPendingQuiz ? "QUIZ STEM PENDIENTE · AVANCE BLOQUEADO" : mission.CanSeparateStage ? "SEPARACIÓN AUTORIZADA" : "SEPARACIÓN BLOQUEADA";
        GUI.Label(new Rect(rect.x + 14, rect.y + 256, width, 36), "ESTADO    " + lockState, textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 294, width, 20), "W/S potencia · A/D guiñada", textStyle);
        GUI.Label(new Rect(rect.x + 14, rect.y + 316, width, 20), "RATÓN DER. girar · RUEDA zoom · N evento", textStyle);
        if (mission.Phase == FlightPhase.Pad && !mission.LaunchRequested && GUI.Button(new Rect(rect.x + 14, rect.y + 340, width, 30), "INICIAR DESPEGUE", buttonStyle)) mission.RequestLaunch();
        else if (GUI.Button(new Rect(rect.x + 14, rect.y + 340, width, 30), mission.FreeFlight ? "VUELO LIBRE ACTIVO" : "ACTIVAR VUELO LIBRE", buttonStyle)) mission.EnableFreeFlight();
    }
    void Tutorial() { Rect rect = new Rect(Screen.width * .5f - 265, Screen.height * .13f, 530, 320); Panel(rect, new Color(.25f, .9f, .72f)); GUI.Label(new Rect(rect.x + 24, rect.y + 20, 470, 28), "GUÍA RÁPIDA DE VUELO", titleStyle); GUI.Label(new Rect(rect.x + 24, rect.y + 58, 470, 184), "TAB  ·  Cabina (controles), Exterior (cohete), Ruta (mapa)\nF1 DU1 ruta · F2 DU2 vuelo · F3 DU3 sistemas\nESC  ·  volver a cabina o cerrar foco\nBOTÓN DERECHO + ARRASTRE  ·  mirar en Cabina o girar Exterior\nRUEDA EN EXTERIOR  ·  zoom sobre el vehículo\nW / S  ·  potencia   A / D  ·  guiñada\nFLECHAS  ·  cabeceo y alabeo\nN  ·  siguiente fase o separación autorizada\nEN EXTERIOR  ·  INICIAR DESPEGUE comienza cuenta atrás\nESPACIO  ·  vuelo libre sin preguntas", textStyle); if (UiButton(new Rect(rect.x + 24, rect.y + 264, 220, 34), "ENTENDIDO", new Color(.06f, .34f, .27f))) tutorial = false; }
    void Panel(Rect rect, Color accent) { Fill(rect, new Color(.012f, .024f, .042f, .96f)); Fill(new Rect(rect.x, rect.y, rect.width, 3), accent); Fill(new Rect(rect.x, rect.y, 2, rect.height), accent * .55f); Fill(new Rect(rect.x + rect.width - 2, rect.y, 2, rect.height), accent * .55f); }
    void Fill(Rect rect, Color color) { Color previous = GUI.color; GUI.color = color; GUI.DrawTexture(rect, Texture2D.whiteTexture); GUI.color = previous; }
    bool UiButton(Rect rect, string label, Color color) { Event current = Event.current; bool hover = rect.Contains(current.mousePosition); Fill(rect, hover ? color * 1.45f : color); Fill(new Rect(rect.x, rect.y + rect.height - 2, rect.width, 2), new Color(.4f, .85f, 1f, .9f)); GUI.Label(rect, label, buttonStyle); if (current.type == EventType.MouseDown && current.button == 0 && hover) { current.Use(); return true; } return false; }

    static void ConfigureAtmosphereRenderer(Renderer renderer, float alpha)
    {
        if (renderer == null) return;
        Material material = renderer.material;
        if (material.HasProperty("_Mode")) material.SetFloat("_Mode", 3f);
        if (material.HasProperty("_Surface")) material.SetFloat("_Surface", 1f);
        material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
        material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
        material.SetInt("_ZWrite", 0);
        material.DisableKeyword("_ALPHATEST_ON");
        material.EnableKeyword("_ALPHABLEND_ON");
        material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
        material.renderQueue = 3000;
        Color color = material.color; color.a = alpha; material.color = color;
    }

    static void SetAtmosphereColor(Renderer renderer, Color color, float alpha)
    {
        if (renderer == null) return;
        color.a = Mathf.Clamp01(alpha);
        renderer.material.color = color;
    }

    static void ConfigureTransparentMaterial(Material material, float alpha)
    {
        if (material == null) return;
        if (material.HasProperty("_Mode")) material.SetFloat("_Mode", 3f);
        if (material.HasProperty("_Surface")) material.SetFloat("_Surface", 1f);
        material.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
        material.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
        material.SetInt("_ZWrite", 0);
        material.DisableKeyword("_ALPHATEST_ON");
        material.EnableKeyword("_ALPHABLEND_ON");
        material.DisableKeyword("_ALPHAPREMULTIPLY_ON");
        material.renderQueue = 3000;
        Color color = material.color; color.a = Mathf.Clamp01(alpha); material.color = color;
    }
}
