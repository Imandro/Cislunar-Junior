using NUnit.Framework;
using System.Reflection;

public sealed class MissionModelTests
{
    [Test]
    public void FlightUsesThrottleAndConsumesFuel()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        mission.Step(10f, 1f);
        mission.Step(1f, 1f);

        Assert.That(mission.AltitudeKm, Is.GreaterThan(0));
        Assert.That(mission.VelocityMs, Is.GreaterThan(0));
        Assert.That(mission.FuelPercent, Is.LessThan(100));
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Launch));
    }

    [Test]
    public void ResetRestoresTheSelectedMission()
    {
        var mission = new MissionModel(MissionProfile.MarsMission);
        mission.EnableFreeFlight();
        mission.Step(10f, 1f);
        mission.Reset(MissionProfile.LunarLanding);

        Assert.That(mission.Profile, Is.EqualTo(MissionProfile.LunarLanding));
        Assert.That(mission.AltitudeKm, Is.Zero);
        Assert.That(mission.FuelPercent, Is.EqualTo(100));
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Pad));
    }

    [Test]
    public void CorrectQuizUnlocksTheNextMilestone()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);

        Assert.That(mission.HasPendingQuiz, Is.True);
        Assert.That(mission.AdvancePhase(), Is.False);
        Assert.That(mission.SubmitQuiz(true), Is.True);
        Assert.That(mission.AdvancePhase(), Is.True);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Launch));
        Assert.That(mission.Score, Is.EqualTo(100));
    }

    [Test]
    public void WrongQuizAnswerKeepsTheMilestoneLocked()
    {
        var mission = new MissionModel(MissionProfile.MarsMission);

        Assert.That(mission.SubmitQuiz(false), Is.False);
        Assert.That(mission.HasPendingQuiz, Is.True);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Pad));
    }

    [Test]
    public void MarsCampaignEndsAtSurface()
    {
        var mission = new MissionModel(MissionProfile.MarsMission);
        int guard = 0;
        while (!mission.IsComplete && guard++ < 100)
        {
            if (mission.HasPendingQuiz) mission.SubmitQuiz(true);
            if (mission.Phase == FlightPhase.Ascent && !mission.SRBsSeparated) SetFlightTelemetry(mission, 45f, 1500f);
            if (mission.Phase == FlightPhase.ParkingOrbit && !mission.CoreSeparated) SetFlightTelemetry(mission, 180f, 7700f);
            mission.AdvancePhase();
        }

        Assert.That(guard, Is.LessThan(100), "Campaign must not stall while advancing valid events.");
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Complete));
        Assert.That(mission.ProgressPercent, Is.EqualTo(100));
    }

    [Test]
    public void CountdownUnlocksLaunchAfterTenSeconds()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        mission.Step(4f, 1f);
        Assert.That(mission.CountdownSeconds, Is.EqualTo(6f).Within(.01f));
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Pad));
        Assert.That(mission.AltitudeKm, Is.Zero);
        Assert.That(mission.VelocityMs, Is.Zero);
        Assert.That(mission.FuelPercent, Is.EqualTo(100f));
        mission.Step(6f, 1f);
        Assert.That(mission.CountdownSeconds, Is.Zero);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Launch));
    }

    [Test]
    public void CampaignLaunchRequiresLaunchRequest()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SubmitQuiz(true);
        mission.Step(11f, 1f);

        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Pad));
        Assert.That(mission.AltitudeKm, Is.Zero);
        Assert.That(mission.RequestLaunch(), Is.True);
        mission.Step(11f, 1f);

        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Launch));
        Assert.That(mission.LaunchState, Is.EqualTo(LaunchVehicleState.Ignition));
        Assert.That(mission.AltitudeKm, Is.GreaterThan(0));
        Assert.That(mission.FuelPercent, Is.LessThan(100f));
    }

    [Test]
    public void NavigationManeuverConsumesFuelAndAdvances()
    {
        var mission = new MissionModel(MissionProfile.LunarLanding);
        while (mission.Phase != FlightPhase.ParkingOrbit)
        {
            if (mission.HasPendingQuiz) mission.SubmitQuiz(true);
            if (mission.Phase == FlightPhase.Ascent && !mission.SRBsSeparated) SetFlightTelemetry(mission, 45f, 1500f);
            Assert.That(mission.AdvancePhase(), Is.True);
        }
        mission.SubmitQuiz(true);
        SetFlightTelemetry(mission, 180f, 7700f);
        float fuel = mission.FuelPercent;
        Assert.That(mission.ManeuverReady, Is.True);
        Assert.That(mission.TryExecuteNextManeuver(), Is.True);
        Assert.That(mission.FuelPercent, Is.LessThan(fuel));
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Transfer));
    }

    [Test]
    public void CourseCorrectionClearsOffNominalError()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        mission.SetControls(.8f, 45f, 45f, 0f);
        mission.Step(13f, .8f);
        Assert.That(mission.CourseErrorDeg, Is.GreaterThan(1.5f));
        Assert.That(mission.TryCorrectCourse(), Is.True);
        Assert.That(mission.CourseErrorDeg, Is.Zero);
    }

    [Test]
    public void CampaignExposesSrbAndCoreSeparationEvents()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SubmitQuiz(true);
        mission.AdvancePhase(); // Launch
        mission.AdvancePhase(); // Ascent
        SetFlightTelemetry(mission, 45f, 1500f);

        Assert.That(mission.AdvancePhase(), Is.True);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Ascent));
        Assert.That(mission.SRBsSeparated, Is.True);
        Assert.That(mission.LaunchState, Is.EqualTo(LaunchVehicleState.SRBSeparation));

        mission.AdvancePhase(); // Parking orbit
        mission.SubmitQuiz(true);
        SetFlightTelemetry(mission, 180f, 7700f);
        Assert.That(mission.AdvancePhase(), Is.True);
        Assert.That(mission.CoreSeparated, Is.True);
        Assert.That(mission.LaunchState, Is.EqualTo(LaunchVehicleState.CoreSeparation));
        mission.AdvancePhase();
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Transfer));
        Assert.That(mission.LaunchState, Is.EqualTo(LaunchVehicleState.Translunar));
    }

    [Test]
    public void FreeFlightAutomaticallySeparatesStagesWhenValid()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        for (int i = 0; i < 300; i++) mission.Step(1f, 1f);

        Assert.That(mission.SRBsSeparated, Is.True);
        Assert.That(mission.CoreSeparated, Is.True);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Transfer));
        Assert.That(mission.LaunchState, Is.EqualTo(LaunchVehicleState.Translunar));
    }

    [Test]
    public void CampaignBlocksSrbSeparationUntilTelemetryIsValid()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SubmitQuiz(true);
        mission.AdvancePhase(); // Launch
        mission.AdvancePhase(); // Ascent
        SetFlightTelemetry(mission, 45f, 1500f);
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 0f);
        SetPrivate(mission, "<VelocityMs>k__BackingField", 0f);

        Assert.That(mission.AdvancePhase(), Is.False);
        Assert.That(mission.SRBsSeparated, Is.False);
        Assert.That(mission.StatusMessage, Does.Contain("autoriz"));
    }

    [Test]
    public void CampaignCannotSeparateTheSameStageTwice()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SubmitQuiz(true);
        mission.AdvancePhase(); // Launch
        mission.AdvancePhase(); // Ascent
        SetFlightTelemetry(mission, 45f, 1500f);

        Assert.That(mission.AdvancePhase(), Is.True);
        Assert.That(mission.TrySeparateStage(), Is.False);
        Assert.That(mission.SRBsSeparated, Is.True);
    }

    [Test]
    public void CampaignBlocksCoreSeparationUntilOrbitIsValid()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SubmitQuiz(true);
        mission.AdvancePhase(); // Launch
        mission.AdvancePhase(); // Ascent
        SetFlightTelemetry(mission, 45f, 1500f);
        mission.AdvancePhase(); // SRB event
        mission.AdvancePhase(); // Parking orbit
        mission.SubmitQuiz(true);
        SetFlightTelemetry(mission, 0f, 0f);
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 0f);
        SetPrivate(mission, "<VelocityMs>k__BackingField", 0f);

        Assert.That(mission.AdvancePhase(), Is.False);
        Assert.That(mission.CoreSeparated, Is.False);
        Assert.That(mission.StatusMessage, Does.Contain("órbita"));
    }

    [Test]
    public void FreeFlightSeparatesStagesOnDifferentTicks()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        int srbTick = -1;
        int coreTick = -1;
        for (int tick = 0; tick < 600 && coreTick < 0; tick++)
        {
            mission.Step(1f, 1f);
            if (mission.SRBsSeparated && srbTick < 0) srbTick = tick;
            if (mission.CoreSeparated && coreTick < 0) coreTick = tick;
        }

        Assert.That(srbTick, Is.GreaterThanOrEqualTo(0));
        Assert.That(coreTick, Is.GreaterThan(srbTick));
    }

    [Test]
    public void CampaignFlightAdvancesTelemetryAfterIgnition()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SubmitQuiz(true);
        mission.AdvancePhase();
        float fuel = mission.FuelPercent;
        mission.Step(3f, 1f);
        Assert.That(mission.LaunchElapsedSeconds, Is.EqualTo(3f));
        Assert.That(mission.LaunchState, Is.EqualTo(LaunchVehicleState.Liftoff));
        Assert.That(mission.AltitudeKm, Is.GreaterThan(0));
        Assert.That(mission.FuelPercent, Is.LessThan(fuel));
    }

    [Test]
    public void AssistedCampaignLeavesIgnitionWithoutManualPhaseClick()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SubmitQuiz(true);
        mission.AdvancePhase();
        mission.Step(4f, 1f);

        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Ascent));
        Assert.That(mission.LaunchState, Is.EqualTo(LaunchVehicleState.Ascent));
    }

    [Test]
    public void EmptyFuelCannotProduceThrust()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        mission.Step(10f, 1f);
        SetPrivate(mission, "<FuelPercent>k__BackingField", 0f);
        mission.Step(1f, 1f);
        Assert.That(mission.AccelerationMs2, Is.LessThanOrEqualTo(0));
        Assert.That(mission.VelocityMs, Is.Zero);
    }

    [Test]
    public void AdvancingPhaseDoesNotTeleportTelemetry()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.SubmitQuiz(true);
        mission.AdvancePhase();
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 12.5f);
        SetPrivate(mission, "<VelocityMs>k__BackingField", 240f);
        mission.AdvancePhase();

        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Ascent));
        Assert.That(mission.AltitudeKm, Is.EqualTo(12.5f).Within(.001f));
        Assert.That(mission.VelocityMs, Is.EqualTo(240f).Within(.001f));
    }

    [Test]
    public void ExteriorUsesMetricWorldUnits()
    {
        Assert.That(LaunchVehicleController.WorldMetersPerUnit, Is.EqualTo(1f));
    }

    [Test]
    public void MarsProfileLaunchesInEarthAtmosphere()
    {
        var earth = new MissionModel(MissionProfile.ArtemisIIExtended);
        var mars = new MissionModel(MissionProfile.MarsMission);
        Assert.That(mars.CurrentBody, Is.EqualTo("TIERRA"));
        Assert.That(mars.AtmosphereName, Is.EqualTo("TROPOSFERA"));
        Assert.That(mars.AtmosphereColor, Is.EqualTo(earth.AtmosphereColor));
    }

    [Test]
    public void EarthAtmosphereReportsEachLayerByAltitude()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 10f); Assert.That(mission.AtmosphereName, Is.EqualTo("TROPOSFERA"));
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 60f); Assert.That(mission.AtmosphereName, Is.EqualTo("MESOSFERA"));
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 100f); Assert.That(mission.AtmosphereName, Is.EqualTo("TERMOSFERA"));
        SetPrivate(mission, "<AltitudeKm>k__BackingField", 170f); Assert.That(mission.AtmosphereName, Is.EqualTo("VACÍO"));
    }

    [Test]
    public void LunarArrivalUsesMoonButReentryReturnsToEarth()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        int guard = 0;
        while (!mission.IsComplete && guard++ < 100)
        {
            if (mission.HasPendingQuiz) mission.SubmitQuiz(true);
            if (mission.Phase == FlightPhase.Ascent && !mission.SRBsSeparated) SetFlightTelemetry(mission, 45f, 1500f);
            if (mission.Phase == FlightPhase.ParkingOrbit && !mission.CoreSeparated) SetFlightTelemetry(mission, 180f, 7700f);
            mission.AdvancePhase();
            if (mission.Phase == FlightPhase.Arrival)
            {
                Assert.That(mission.CurrentBody, Is.EqualTo("LUNA"));
                Assert.That(mission.AtmosphereName, Is.EqualTo("VACÍO"));
            }
            if (mission.Phase == FlightPhase.Reentry)
                Assert.That(mission.CurrentBody, Is.EqualTo("TIERRA"));
        }
        Assert.That(guard, Is.LessThan(100), "Campaign must not stall while checking body transitions.");
        Assert.That(mission.CurrentBody, Is.EqualTo("TIERRA"));
    }

    [Test]
    public void LunarReturnUsesEarthEnvironment()
    {
        var mission = new MissionModel(MissionProfile.LunarLanding);
        mission.EnableFreeFlight();
        while (mission.Phase != FlightPhase.Return) mission.AdvancePhase();
        Assert.That(mission.CurrentBody, Is.EqualTo("TIERRA"));
        Assert.That(mission.AtmosphereName, Is.EqualTo("TROPOSFERA"));
    }

    [Test]
    public void FreeFlightManeuverLeavesTransferInsteadOfChargingAgain()
    {
        var mission = new MissionModel(MissionProfile.ArtemisIIExtended);
        mission.EnableFreeFlight();
        for (int i = 0; i < 600 && mission.Phase != FlightPhase.Transfer; i++) mission.Step(1f, 1f);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Transfer));
        Assert.That(mission.TryExecuteNextManeuver(), Is.True);
        Assert.That(mission.Phase, Is.EqualTo(FlightPhase.Arrival));
    }

    static void SetPrivate<T>(MissionModel mission, string fieldName, T value)
    {
        var field = typeof(MissionModel).GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.That(field, Is.Not.Null);
        field.SetValue(mission, value);
    }

    static void SetFlightTelemetry(MissionModel mission, float altitude, float velocity)
    {
        SetPrivate(mission, "<AltitudeKm>k__BackingField", altitude);
        SetPrivate(mission, "<VelocityMs>k__BackingField", velocity);
        SetPrivate(mission, "<LaunchState>k__BackingField", LaunchVehicleState.Ascent);
    }
}
