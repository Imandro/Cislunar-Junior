# Cislunar Junior - Unity

Simulador educativo procedural: cabina Orion, tres DUs, vista exterior, ruta heliocéntrica, vuelo libre y perfiles Artemis II extendida, alunizaje y Marte.

## Abrir

1. Abrir esta carpeta desde Unity Hub con Unity 6000.6.6f1.
2. Abrir Assets/Scenes/CislunarJunior.unity.
3. Ejecutar la escena.

## Controles

- Cabina, Exterior y Ruta comparten el estado de misión. Instrumentos acerca la cámara a DU2 dentro de Cabina.
- Clic sobre DU1, DU2 o DU3, o F1/F2/F3: enfocar la pantalla física. Esc: volver al encuadre general.
- Boton derecho + arrastre: mirar en Cabina/Instrumentos.
- W/S: ajustar potencia en Exterior.
- A/D: guiñada; flechas: cabeceo y alabeo.
- N: avanzar fase o solicitar separación cuando esté autorizada.
- Exterior: `INICIAR DESPEGUE` comienza la cuenta atrás; el vehículo no despega solo.
- Espacio: activar vuelo libre sin preguntas obligatorias.
- Ruta: `EJECUTAR MANIOBRA` aplica el siguiente delta-v; `CORREGIR RUTA` consume combustible y reduce el error.
- Exterior muestra cuenta regresiva, estado de encendido, presión dinámica y etapa activa.
- Esc: cerrar el tutorial.
- 1, 2, 3: Artemis II extendida, alunizaje y Marte.
- N: avanzar una fase para estudiarla.
- Tab: alternar entre Cabina, Exterior y Ruta.

La cabina y el exterior usan solo los archivos entregados por el usuario en `NASA-source/user-provided/`. SLS usa `Assets/Resources/NASA/Artemis2_reference.fbx` y `Artemis2_SLS.png`, copias exactas de `nasa-artemis-ii-space-launch-system-sls.zip`. Orion usa `Orion_ArtemisII.fbx`, convertido desde `orion-spacecraft.zip`. El FBX SLS es una malla única: el runtime lo muestra texturizado en plataforma y ascenso, y activa un rig local alineado solo para separar SRB y etapa central. No se cargan modelos alternativos de SLS u Orion. Consulta [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

El vehículo ejecuta estados didácticos de plataforma, encendido, ascenso, separación
de SRB, separación de etapa central, ICPS, vuelo Orion, descenso, reentrada y splashdown.
Plume, humo, torre móvil, paneles solares y cambios de vehículo son visuales
educativos; no representan una trayectoria certificada.

Estado verificado de esta etapa:

- Ascenso continuo después de cuenta regresiva; `RocketRoot` deja el deck.
- Tres núcleos visuales RS-25; humo desacoplado de `RocketRoot`, limitado a baja altitud.
- Plataforma y torre se ocultan por despeje; atmósfera y estrellas cambian con altitud/cuerpo.
- SRB/core se separan con autorización; Orion queda única tras ICPS.
- Cabina excluye `ExteriorLayer`; ventana conserva render exterior sincronizado.
- Build Windows verificada en Unity 6000.6.6f1. Las pruebas automatizadas deben ejecutarse desde Test Runner.

En vuelo libre, pulsa `ESPACIO` para activar el modo y `INICIAR DESPEGUE` para comenzar la cuenta regresiva. La separación SRB
requiere ascenso válido; la etapa central requiere órbita y velocidad válidas. Cuando el FBX SLS llega como malla única, sigue siendo la fuente visual principal. El rig auxiliar
solo aparece durante las transiciones de separación; así no se duplica el cohete y las
etapas siguen siendo visibles y separables.

La cámara Exterior encuadra los bounds del vehículo activo y compensa ventanas estrechas.
La ventana frontal usa una RenderTexture con proporción 1024×304 para evitar estiramiento.
La plataforma incluye raíles, trinchera y horizonte atmosférico por altitud.

Durante Plataforma, Órbita y Descenso, el modo misión muestra una decisión educativa. La opción conservadora consume combustible y aumenta el margen de seguridad; la otra conserva combustible y reduce ese margen.

DU1 comparte el estado de navegación con Ruta: segmento, próximo hito, distancia, error de trayectoria,
delta-v requerido y ventana de maniobra. DU2 muestra cuenta regresiva, pitch y potencia; DU3 muestra
autorización y estado de RS-25, SRB, ICPS, Orion, comunicaciones, temperatura y margen.

## Objetivo educativo

Cada perfil explica la relación entre propulsión, combustible, altitud, velocidad, fases orbitales y destino. El modo vuelo libre permite experimentar; el modo misión permite estudiar cada fase de forma controlada.

## MCP Unity

El paquete se declara en Packages/manifest.json. Tras abrir Unity, iniciar el servidor desde Tools > MCP Unity > Server Window y configurar Codex con el ejecutable generado por el paquete.

## Build de Windows

En Unity, usa `Cislunar > Build Windows`. La build se genera en `Builds/Windows/CislunarJunior-Orion.exe`.
