using System;
using UnityEngine;

public enum MissionProfile { ArtemisIIExtended, LunarLanding, MarsMission }
public enum ViewMode { Cockpit, Exterior, Route }
public enum CockpitFocus { Overview, Route, Flight, Systems }
public enum FlightPhase { Pad, Launch, Ascent, ParkingOrbit, Transfer, Arrival, Descent, Surface, Return, Reentry, Complete }
public enum LaunchVehicleState { Pad, Ignition, Liftoff, Ascent, SRBSeparation, CoreSeparation, ICPSBurn, Translunar, OrionFlight, LunarApproach, LanderDescent, Surface, Return, Reentry, Splashdown }

public sealed class NavigationSnapshot
{
    public string Body;
    public string Segment;
    public string NextManeuver;
    public float DistanceToWaypointKm;
    public float CourseErrorDeg;
    public float RequiredDeltaV;
    public float TimeToManeuver;
    public bool ManeuverReady;
}

public sealed class MissionModel
{
    static readonly FlightPhase[] ArtemisPath = { FlightPhase.Pad, FlightPhase.Launch, FlightPhase.Ascent, FlightPhase.ParkingOrbit, FlightPhase.Transfer, FlightPhase.Arrival, FlightPhase.Descent, FlightPhase.Surface, FlightPhase.Return, FlightPhase.Reentry, FlightPhase.Complete };
    static readonly FlightPhase[] LunarPath = { FlightPhase.Pad, FlightPhase.Launch, FlightPhase.Ascent, FlightPhase.ParkingOrbit, FlightPhase.Transfer, FlightPhase.Arrival, FlightPhase.Descent, FlightPhase.Surface, FlightPhase.Return, FlightPhase.Complete };
    static readonly FlightPhase[] MarsPath = { FlightPhase.Pad, FlightPhase.Launch, FlightPhase.Ascent, FlightPhase.ParkingOrbit, FlightPhase.Transfer, FlightPhase.Arrival, FlightPhase.Descent, FlightPhase.Surface, FlightPhase.Complete };

    public MissionProfile Profile { get; private set; }
    public FlightPhase Phase { get; private set; }
    public bool FreeFlight { get; private set; }
    public float AltitudeKm { get; private set; }
    public float VelocityMs { get; private set; }
    public float FuelPercent { get; private set; }
    public float SafetyMargin { get; private set; }
    public float MissionSeconds { get; private set; }
    public float VerticalVelocityMs { get; private set; }
    public float HorizontalVelocityMs { get; private set; }
    public float AccelerationMs2 { get; private set; }
    public float DeltaVRemaining { get; private set; }
    public float TemperatureC { get; private set; }
    public float DynamicPressureKpa { get; private set; }
    public LaunchVehicleState LaunchState { get; private set; }
    public float Throttle { get; private set; }
    public float Pitch { get; private set; }
    public float Yaw { get; private set; }
    public float Roll { get; private set; }
    public bool SRBsSeparated => separationIndex >= 1;
    public bool CoreSeparated => separationIndex >= 2;
    public bool CanSeparateStage =>
        (Phase == FlightPhase.Ascent && !SRBsSeparated && LaunchState >= LaunchVehicleState.Liftoff && AltitudeKm >= 20f && VelocityMs >= 900f) ||
        (Phase == FlightPhase.ParkingOrbit && SRBsSeparated && !CoreSeparated && AltitudeKm >= 160f && VelocityMs >= 7000f);
    public string RouteSegment { get; private set; }
    public float CourseErrorDeg { get; private set; }
    public float DistanceToWaypointKm { get; private set; }
    public string NextManeuver { get; private set; }
    public bool ManeuverReady { get; private set; }
    public float RequiredDeltaV { get; private set; }
    public float TimeToManeuver { get; private set; }
    public float CountdownSeconds { get; private set; }
    public float LaunchElapsedSeconds { get; private set; }
    internal float PhaseElapsedSeconds { get; private set; }
    public NavigationSnapshot Navigation => new NavigationSnapshot { Body = CurrentBody, Segment = RouteSegment, NextManeuver = NextManeuver, DistanceToWaypointKm = DistanceToWaypointKm, CourseErrorDeg = CourseErrorDeg, RequiredDeltaV = RequiredDeltaV, TimeToManeuver = TimeToManeuver, ManeuverReady = ManeuverReady };
    public string VehicleStage { get; private set; }
    public string OrbitalPosition { get; private set; }
    public string Communications { get; private set; }
    public int Score { get; private set; }
    public int ProgressPercent => Mathf.RoundToInt(100f * stepIndex / (Path.Length - 1));
    public bool IsComplete => Phase == FlightPhase.Complete;
    public string StatusMessage { get; private set; }
    int stepIndex;
    bool quizSolved;
    bool launchRequested;
    int separationIndex;
    float separationEventMissionSeconds;
    float phaseTransitionElapsed;
    float phaseTransitionDuration;
    float phaseTransitionStartAltitude;
    float phaseTransitionStartVelocity;
    float phaseTransitionTargetAltitude;
    float phaseTransitionTargetVelocity;
    bool phaseTransitionActive;

    FlightPhase[] Path => Profile == MissionProfile.ArtemisIIExtended ? ArtemisPath : Profile == MissionProfile.LunarLanding ? LunarPath : MarsPath;
    public string Destination => Profile == MissionProfile.MarsMission ? "MARTE" : "LUNA";
    public string CurrentBody => Profile == MissionProfile.MarsMission && Phase >= FlightPhase.Arrival ? "MARTE" : Phase >= FlightPhase.Arrival && Phase < FlightPhase.Return ? "LUNA" : "TIERRA";
    public string NextMilestone => IsComplete ? "MISIÓN COMPLETA" : Path[Mathf.Min(stepIndex + 1, Path.Length - 1)].ToString().ToUpper();
    public string AtmosphereName => CurrentBody == "LUNA" ? "VACÍO" : CurrentBody == "MARTE" ?
        (AltitudeKm < 40 ? "ATMÓSFERA MARCIANA" : "EXOSFERA MARCIANA") :
        AltitudeKm < 12 ? "TROPOSFERA" : AltitudeKm < 50 ? "ESTRATOSFERA" : AltitudeKm < 85 ? "MESOSFERA" : AltitudeKm < 120 ? "TERMOSFERA" : AltitudeKm < 160 ? "EXOSFERA" : "VACÍO";
    public string Vehicle => Profile == MissionProfile.MarsMission ? "VEHÍCULO MARTE" : "ORION / SLS";
    public string MissionName => Profile == MissionProfile.ArtemisIIExtended ? "ARTEMIS II EXTENDIDA" : Profile == MissionProfile.LunarLanding ? "ALUNIZAJE LUNAR" : "MISIÓN MARTE";
    public bool HasPendingQuiz => !FreeFlight && !IsComplete && RequiresQuiz(Phase) && !quizSolved;
    public string QuizTitle => "COMPROBACIÓN STEM · " + Phase.ToString().ToUpper();
    public string QuizQuestion => Phase == FlightPhase.Pad ? "¿Qué debe superar el empuje para iniciar el despegue?" : Phase == FlightPhase.ParkingOrbit ? "¿Qué hace falta, además de altura, para permanecer en órbita?" : Phase == FlightPhase.Descent ? "¿Qué se debe vigilar durante el descenso?" : "¿Qué recurso limita cada maniobra?";
    public string QuizOptionA => Phase == FlightPhase.Pad ? "El peso de la nave" : Phase == FlightPhase.ParkingOrbit ? "Velocidad lateral suficiente" : Phase == FlightPhase.Descent ? "Velocidad vertical y combustible" : "Combustible disponible";
    public string QuizOptionB => Phase == FlightPhase.Pad ? "El color del cielo" : Phase == FlightPhase.ParkingOrbit ? "Solo altitud" : Phase == FlightPhase.Descent ? "Solo la hora" : "El brillo de las estrellas";
    public string LearningObjective => Phase == FlightPhase.Pad ? "Identifica los sistemas antes del encendido." : Phase == FlightPhase.Launch ? "Observa cómo el empuje vence el peso." : Phase == FlightPhase.Ascent ? "Compara altitud, velocidad y consumo." : Phase == FlightPhase.ParkingOrbit ? "Una órbita requiere velocidad lateral." : Phase == FlightPhase.Transfer ? "Estudia la transferencia hacia " + Destination + "." : Phase == FlightPhase.Arrival ? "Prepara la maniobra de llegada." : Phase == FlightPhase.Descent ? "Reduce velocidad sin agotar combustible." : Phase == FlightPhase.Surface ? "Compara el entorno y la gravedad." : Phase == FlightPhase.Return ? "Planifica el encendido de regreso." : Phase == FlightPhase.Reentry ? "Protege la nave durante la reentrada." : "Repasa la misión completada.";

    public MissionModel(MissionProfile profile) => Reset(profile);

    public void Reset(MissionProfile profile)
    {
        Profile = profile; stepIndex = 0; Phase = Path[0]; FreeFlight = false;
        AltitudeKm = 0; VelocityMs = 0; FuelPercent = 100; SafetyMargin = 100; MissionSeconds = 0; Score = 0;
        VerticalVelocityMs = 0; HorizontalVelocityMs = 0; AccelerationMs2 = 0; DeltaVRemaining = 9400; TemperatureC = 18; DynamicPressureKpa = 0;
        VehicleStage = "SLS · EN TIERRA"; OrbitalPosition = "PLATAFORMA"; Communications = "NOMINAL";
        LaunchState = LaunchVehicleState.Pad; Throttle = .72f; Pitch = Yaw = Roll = 0;
        quizSolved = false; launchRequested = false; separationIndex = 0; separationEventMissionSeconds = -1; CourseErrorDeg = 0; CountdownSeconds = 10; LaunchElapsedSeconds = 0; PhaseElapsedSeconds = 0;
        phaseTransitionElapsed = 0; phaseTransitionDuration = 0; phaseTransitionStartAltitude = phaseTransitionTargetAltitude = 0; phaseTransitionStartVelocity = phaseTransitionTargetVelocity = 0; phaseTransitionActive = false;
        SetNavigationTelemetry(); StatusMessage = "Completa la comprobación STEM para desbloquear el primer hito.";
    }

    public void EnableFreeFlight() { FreeFlight = true; StatusMessage = "Vuelo libre activo: experimenta sin bloqueos de campaña."; RequestLaunch(); }
    public bool LaunchRequested => launchRequested;
    public bool RequestLaunch()
    {
        if (Phase != FlightPhase.Pad || launchRequested) return false;
        launchRequested = true;
        StatusMessage = "Cuenta atrás iniciada. Revisa potencia y trayectoria.";
        return true;
    }

    public void SetControls(float throttle, float pitch, float yaw, float roll)
    {
        Throttle = Mathf.Clamp01(throttle); Pitch = Mathf.Clamp(pitch, -45f, 45f); Yaw = Mathf.Clamp(yaw, -45f, 45f); Roll = Mathf.Clamp(roll, -45f, 45f);
    }

    public void SetLaunchState(LaunchVehicleState state) => LaunchState = state;

    public bool TrySeparateStage()
    {
        if (!CanSeparateStage) { StatusMessage = "Separación no autorizada en esta fase."; return false; }
        separationIndex = Phase == FlightPhase.Ascent ? 1 : 2;
        separationEventMissionSeconds = MissionSeconds;
        LaunchState = Phase == FlightPhase.Ascent ? LaunchVehicleState.SRBSeparation : LaunchVehicleState.CoreSeparation;
        StatusMessage = Phase == FlightPhase.Ascent ? "SRB separados. Mantén la trayectoria y prepara etapa central." : "Etapa central separada. ICPS listo para encendido.";
        return true;
    }

    public bool TryExecuteNextManeuver()
    {
        if (!ManeuverReady || RequiredDeltaV <= 0 || FuelPercent <= 0 || DeltaVRemaining < RequiredDeltaV) { StatusMessage = "Maniobra no disponible: espera ventana o revisa combustible."; return false; }
        if (Phase == FlightPhase.ParkingOrbit && !CoreSeparated && !CanSeparateStage) { StatusMessage = "Sépara la etapa central antes del encendido ICPS."; return false; }
        float fuelCost = Mathf.Clamp(RequiredDeltaV / 94f, 1.5f, 18f);
        FuelPercent = Mathf.Max(0, FuelPercent - fuelCost);
        DeltaVRemaining = Mathf.Max(0, DeltaVRemaining - RequiredDeltaV);
        CourseErrorDeg = 0; ManeuverReady = false; TimeToManeuver = 24;
        StatusMessage = "Maniobra ejecutada. La ruta se está corrigiendo con asistencia STEM.";
        if (Phase == FlightPhase.ParkingOrbit && !CoreSeparated && CanSeparateStage) TrySeparateStage();
        if (!HasPendingQuiz && Phase != FlightPhase.Pad && Phase != FlightPhase.Ascent && !IsComplete) AdvancePhase();
        SetNavigationTelemetry();
        return true;
    }

    public bool TryCorrectCourse()
    {
        if (CourseErrorDeg < 1.5f || FuelPercent < 1.8f || DeltaVRemaining < 18f) { StatusMessage = "No hay corrección necesaria o falta combustible."; return false; }
        FuelPercent = Mathf.Max(0, FuelPercent - 1.8f); DeltaVRemaining = Mathf.Max(0, DeltaVRemaining - 18f);
        SafetyMargin = Mathf.Max(0, SafetyMargin - 2.5f); CourseErrorDeg = 0; StatusMessage = "Corrección aplicada. Verifica el nuevo margen de seguridad.";
        SetNavigationTelemetry(); return true;
    }

    public bool SubmitQuiz(bool answerA)
    {
        if (!HasPendingQuiz) return false;
        if (!answerA)
        {
            Score = Mathf.Max(0, Score - 20);
            StatusMessage = "Aún no. Lee el objetivo de aprendizaje y vuelve a intentarlo.";
            return false;
        }
        quizSolved = true; Score += 100;
        if (Phase == FlightPhase.Pad) { FuelPercent = Mathf.Max(0, FuelPercent - 3); SafetyMargin = 100; }
        if (Phase == FlightPhase.Descent) SafetyMargin = Mathf.Min(100, SafetyMargin + 8);
        SetNavigationTelemetry();
        StatusMessage = "Correcto. Hito desbloqueado: pulsa N o AVANZAR FASE.";
        return true;
    }

    public bool AdvancePhase()
    {
        if (IsComplete) return false;
        if (HasPendingQuiz) { StatusMessage = "Resuelve la comprobación STEM antes de continuar."; return false; }
        if (!FreeFlight && Phase == FlightPhase.Ascent && !SRBsSeparated)
        {
            if (!CanSeparateStage) { StatusMessage = "SRB aún no autorizados: alcanza altitud y velocidad de separación."; return false; }
            TrySeparateStage(); StatusMessage = "SRB separados. Pulsa N para continuar a órbita."; return true;
        }
        if (!FreeFlight && Phase == FlightPhase.ParkingOrbit && !CoreSeparated)
        {
            if (!CanSeparateStage) { StatusMessage = "Etapa central aún no autorizada: confirma órbita y velocidad."; return false; }
            TrySeparateStage(); StatusMessage = "Etapa central separada. Pulsa N para iniciar ICPS."; return true;
        }
        stepIndex = Mathf.Min(stepIndex + 1, Path.Length - 1);
        Phase = Path[stepIndex]; quizSolved = !RequiresQuiz(Phase);
        PhaseElapsedSeconds = 0;
        StartPhaseTransition();
        SetPhaseTelemetry(); UpdateLaunchState(); SetNavigationTelemetry();
        StatusMessage = IsComplete ? "Misión completada. Consulta el resumen de aprendizaje." : "Nuevo hito: " + LearningObjective;
        return true;
    }

    public void Step(float seconds, float throttle)
    {
        if (seconds <= 0 || IsComplete) return;
        if (Phase == FlightPhase.Surface)
        {
            ApplyPhaseTransition(seconds);
            SetPhaseTelemetry(); SetNavigationTelemetry();
            return;
        }
        MissionSeconds += seconds; throttle = Mathf.Clamp01(throttle);
        // Campaign uses nominal launch power; only free flight can hold the pad with low throttle.
        if (!FreeFlight) throttle = Mathf.Max(throttle, .72f);
        Throttle = throttle;
        if (Phase == FlightPhase.Pad)
        {
            if (!launchRequested) return;
            float countdownTime = Mathf.Min(seconds, CountdownSeconds);
            CountdownSeconds -= countdownTime;
            seconds -= countdownTime;
            if (CountdownSeconds > 0 || (FreeFlight && throttle <= .2f)) return;
            // Campaign launch is assisted; the pad quiz remains available for manual review,
            // but it must not freeze the vehicle on the deck.
            if (FreeFlight) AdvancePhase();
            else AdvanceLaunchAfterCountdown();
            if (seconds <= 0) return;
        }
        CountdownSeconds = 0;
        PhaseElapsedSeconds += seconds;
        LaunchElapsedSeconds += seconds;
        // Fuel exhaustion must stop thrust, even when the throttle command remains high.
        throttle = Mathf.Min(throttle, FuelPercent / (.18f * seconds));
        float gravity = CurrentBody == "MARTE" ? 3.71f : CurrentBody == "LUNA" ? 1.62f : 9.81f;
        float thrust = throttle * 34f;
        float drag = Mathf.Clamp01(1f - AltitudeKm / 90f) * Mathf.Clamp(VelocityMs / 1800f, 0, 1) * 7f;
        AccelerationMs2 = thrust - gravity * .12f - drag;
        VelocityMs = Mathf.Clamp(VelocityMs + AccelerationMs2 * seconds, 0, 10800);
        VerticalVelocityMs = Mathf.Max(0, VelocityMs * (Phase <= FlightPhase.Ascent ? .92f : .18f));
        HorizontalVelocityMs = VelocityMs - VerticalVelocityMs;
        FuelPercent = Mathf.Max(0, FuelPercent - throttle * .18f * seconds);
        DeltaVRemaining = Mathf.Max(0, FuelPercent * 94f);
        SafetyMargin = Mathf.Max(0, SafetyMargin - throttle * .012f * seconds - DynamicPressureKpa * .0002f * seconds);
        float attitudeDrift = Mathf.Abs(Pitch) * .012f + Mathf.Abs(Yaw) * .01f;
        CourseErrorDeg = Mathf.Clamp(CourseErrorDeg + attitudeDrift * seconds - (Mathf.Abs(Pitch) < 5f ? .35f * seconds : 0), 0, 45f);
        AltitudeKm += VerticalVelocityMs * seconds / 1000f;
        DynamicPressureKpa = Mathf.Max(0, .5f * Mathf.Exp(-AltitudeKm / 8f) * VelocityMs * VelocityMs * .000012f);
        TemperatureC = 18f + DynamicPressureKpa * 2.4f;
        ApplyPhaseTransition(seconds);
        OrbitalPosition = Phase >= FlightPhase.Transfer ? "TRAYECTORIA " + Destination : Phase >= FlightPhase.ParkingOrbit ? "ÓRBITA BAJA" : "ASCENSO";
        Communications = DynamicPressureKpa > 70 ? "ATENUADA" : "NOMINAL";
        SetPhaseTelemetry();
        bool phaseAdvanced = false;
        // Assisted campaign leaves ignition automatically after a short liftoff window.
        if (!FreeFlight && Phase == FlightPhase.Launch && PhaseElapsedSeconds >= 4f) phaseAdvanced = AdvancePhase();
        // Assisted campaign keeps the launch sequence moving once telemetry is valid.
        if (!FreeFlight && !phaseAdvanced && Phase == FlightPhase.Ascent && CanSeparateStage && PhaseElapsedSeconds >= 12f)
            phaseAdvanced = TrySeparateStage();
        if (!FreeFlight && !phaseAdvanced && Phase == FlightPhase.Ascent && SRBsSeparated && PhaseElapsedSeconds >= 15f)
            phaseAdvanced = AdvancePhase();
        if (!FreeFlight && !phaseAdvanced && Phase == FlightPhase.ParkingOrbit && !HasPendingQuiz && CanSeparateStage && PhaseElapsedSeconds >= 8f)
            phaseAdvanced = TrySeparateStage();
        if (!FreeFlight && !phaseAdvanced && Phase == FlightPhase.ParkingOrbit && CoreSeparated && !HasPendingQuiz && PhaseElapsedSeconds >= 11f)
            phaseAdvanced = AdvancePhase();
        if (FreeFlight && Phase == FlightPhase.Pad && MissionSeconds >= 10f && throttle > .2f) phaseAdvanced = AdvancePhase();
        if (FreeFlight && Phase == FlightPhase.Launch && AltitudeKm > 5) phaseAdvanced = AdvancePhase();
        if (FreeFlight && Phase == FlightPhase.Ascent && SRBsSeparated && AltitudeKm > 160) phaseAdvanced = AdvancePhase();
        if (FreeFlight && Phase == FlightPhase.ParkingOrbit && CoreSeparated && MissionSeconds > 35) phaseAdvanced = AdvancePhase();
        // Do not separate the next stage in the same tick that changes phase.
        if (FreeFlight && !phaseAdvanced && CanSeparateStage && LaunchElapsedSeconds >= 35f) TrySeparateStage();
        if (FuelPercent <= 0) StatusMessage = "Sin combustible: reinicia la misión y administra el acelerador.";
        UpdateLaunchState(); SetNavigationTelemetry();
    }

    void AdvanceLaunchAfterCountdown()
    {
        stepIndex = Mathf.Min(1, Path.Length - 1);
        Phase = FlightPhase.Launch;
        quizSolved = true;
        PhaseElapsedSeconds = 0;
        SetPhaseTelemetry();
        UpdateLaunchState();
        StatusMessage = "Cuenta completada. Ignición y despegue asistidos activos.";
    }

    void StartPhaseTransition()
    {
        // Flight telemetry advances through thrust and gravity; never teleport to a phase target.
        phaseTransitionElapsed = 0;
        phaseTransitionStartAltitude = AltitudeKm;
        phaseTransitionStartVelocity = VelocityMs;
        phaseTransitionTargetAltitude = AltitudeKm;
        phaseTransitionTargetVelocity = VelocityMs;
        phaseTransitionDuration = 0;
        phaseTransitionActive = false;
    }

    void ApplyPhaseTransition(float seconds)
    {
        if (!phaseTransitionActive) return;
        phaseTransitionElapsed += Mathf.Max(0, seconds);
        float t = Mathf.Clamp01(phaseTransitionElapsed / phaseTransitionDuration);
        t = t * t * (3f - 2f * t);
        float altitude = Mathf.Lerp(phaseTransitionStartAltitude, phaseTransitionTargetAltitude, t);
        float velocity = Mathf.Lerp(phaseTransitionStartVelocity, phaseTransitionTargetVelocity, t);
        AltitudeKm = phaseTransitionTargetAltitude >= phaseTransitionStartAltitude ? Mathf.Max(AltitudeKm, altitude) : Mathf.Min(AltitudeKm, altitude);
        VelocityMs = phaseTransitionTargetVelocity >= phaseTransitionStartVelocity ? Mathf.Max(VelocityMs, velocity) : Mathf.Min(VelocityMs, velocity);
        if (t >= 1f) phaseTransitionActive = false;
    }

    void SetPhaseTelemetry()
    {
        VehicleStage = Phase <= FlightPhase.Ascent ? "SLS · ASCENSO" : Phase <= FlightPhase.Transfer ? "ORION · SERVICIO" : Phase <= FlightPhase.Return ? "ORION · RETORNO" : "ORION · REENTRADA";
        if (Phase == FlightPhase.Descent || Phase == FlightPhase.Surface) VehicleStage = Profile == MissionProfile.MarsMission ? "MÓDULO MARCIANO · DESCENSO" : "MÓDULO LUNAR · DESCENSO";
        OrbitalPosition = Phase == FlightPhase.Pad ? "PLATAFORMA" : Phase <= FlightPhase.Ascent ? "ASCENSO" : Phase == FlightPhase.ParkingOrbit ? "ÓRBITA BAJA" : "TRAYECTORIA " + Destination;
        Communications = DynamicPressureKpa > 70 ? "ATENUADA" : "NOMINAL";
    }

    void UpdateLaunchState()
    {
        if (LaunchState == LaunchVehicleState.SRBSeparation && Phase == FlightPhase.Ascent) return;
        if (LaunchState == LaunchVehicleState.CoreSeparation && Phase == FlightPhase.ParkingOrbit && MissionSeconds - separationEventMissionSeconds < 3f) return;
        if (Phase == FlightPhase.Launch && LaunchElapsedSeconds > 2f) { LaunchState = LaunchVehicleState.Liftoff; return; }
        LaunchState = Phase == FlightPhase.Pad ? LaunchVehicleState.Pad :
            Phase == FlightPhase.Launch ? LaunchVehicleState.Ignition :
            Phase == FlightPhase.Ascent ? (SRBsSeparated ? LaunchVehicleState.SRBSeparation : LaunchVehicleState.Ascent) :
            Phase == FlightPhase.ParkingOrbit ? (CoreSeparated ? LaunchVehicleState.ICPSBurn : LaunchVehicleState.CoreSeparation) :
            Phase == FlightPhase.Transfer ? LaunchVehicleState.Translunar :
            Phase == FlightPhase.Arrival ? LaunchVehicleState.LunarApproach :
            Phase == FlightPhase.Descent ? LaunchVehicleState.LanderDescent :
            Phase == FlightPhase.Surface ? LaunchVehicleState.Surface :
            Phase == FlightPhase.Return ? LaunchVehicleState.Return :
            Phase == FlightPhase.Reentry ? LaunchVehicleState.Reentry : LaunchVehicleState.Splashdown;
    }

    void SetNavigationTelemetry()
    {
        RouteSegment = Phase <= FlightPhase.Ascent ? "TIERRA · ASCENSO" :
            Phase == FlightPhase.ParkingOrbit ? "ÓRBITA TERRESTRE" :
            Phase == FlightPhase.Transfer ? "TRANSFERENCIA · " + Destination :
            Phase == FlightPhase.Arrival ? "APROXIMACIÓN · " + Destination :
            Phase == FlightPhase.Descent || Phase == FlightPhase.Surface ? "SUPERFICIE · " + Destination : "REGRESO · TIERRA";
        NextManeuver = Phase == FlightPhase.Pad ? "ENCENDIDO" : Phase == FlightPhase.Launch ? "PITCH PROGRAMADO" : Phase == FlightPhase.Ascent ? "SEPARACIÓN SRB" : Phase == FlightPhase.ParkingOrbit ? "INYECCIÓN TRANSFERENCIA" : Phase == FlightPhase.Transfer ? "CORRECCIÓN DE RUTA" : Phase == FlightPhase.Arrival ? "FRENADO DE LLEGADA" : Phase == FlightPhase.Descent ? "DESCENSO CONTROLADO" : Phase == FlightPhase.Surface ? "ASCENSO DE RETORNO" : Phase == FlightPhase.Return ? "REENTRADA" : "MISIÓN COMPLETA";
        RequiredDeltaV = Phase == FlightPhase.ParkingOrbit ? 820f : Phase == FlightPhase.Transfer ? 180f : Phase == FlightPhase.Arrival ? 260f : Phase == FlightPhase.Descent ? 120f : Phase == FlightPhase.Return ? 300f : 0;
        DistanceToWaypointKm = Phase <= FlightPhase.Ascent ? Mathf.Max(0, 180f - AltitudeKm) : Phase == FlightPhase.ParkingOrbit ? 384400f : Phase == FlightPhase.Transfer ? 220000f : Phase == FlightPhase.Arrival ? 1200f : Phase == FlightPhase.Descent ? Mathf.Max(0, AltitudeKm) : 0;
        TimeToManeuver = Mathf.Max(0, RequiredDeltaV > 0 ? 90f - MissionSeconds % 90f : 0);
        if (!FreeFlight && Phase >= FlightPhase.ParkingOrbit && !HasPendingQuiz) TimeToManeuver = 0;
        ManeuverReady = RequiredDeltaV > 0 && FuelPercent > RequiredDeltaV / 94f && !HasPendingQuiz && !IsComplete && Phase >= FlightPhase.ParkingOrbit;
    }

    public Color AtmosphereColor
    {
        get
        {
            if (CurrentBody == "LUNA") return new Color(.004f, .006f, .014f);
            float altitude = Mathf.Clamp(AltitudeKm, 0, 160);
            Color[] earthBands = { new Color(.09f, .34f, .68f), new Color(.035f, .13f, .34f), new Color(.012f, .04f, .13f), new Color(.004f, .012f, .045f), new Color(.002f, .006f, .022f), new Color(.001f, .002f, .009f) };
            Color[] marsBands = { new Color(.48f, .18f, .08f), new Color(.25f, .08f, .035f), new Color(.08f, .025f, .018f), new Color(.015f, .008f, .012f), new Color(.004f, .006f, .014f), new Color(.002f, .004f, .012f) };
            Color[] bands = CurrentBody == "MARTE" ? marsBands : earthBands;
            float[] limits = { 0, 12, 50, 85, 120, 160 };
            int index = 0;
            while (index < limits.Length - 2 && altitude >= limits[index + 1]) index++;
            return Color.Lerp(bands[index], bands[index + 1], Mathf.InverseLerp(limits[index], limits[index + 1], altitude));
        }
    }

    static bool RequiresQuiz(FlightPhase phase) => phase == FlightPhase.Pad || phase == FlightPhase.ParkingOrbit || phase == FlightPhase.Descent;
}
