# Cabina Orion

Cabina inspirada en Orion/Artemis II desde el punto de vista de la tripulación.

## Activos oficiales

- SLS: `NASA-source/user-provided/nasa-artemis-ii-space-launch-system-sls.zip`.
  - Runtime: `Assets/Resources/NASA/Artemis2_reference.fbx`.
  - Textura: `Assets/Resources/NASA/Artemis2_SLS.png`.
- Orion: `NASA-source/user-provided/orion-spacecraft.zip`.
  - `source/orionspacecraft.glb` convertido a
    `Assets/Resources/NASA/Orion_ArtemisII.fbx`.

El SLS entregado es una malla única. El runtime usa un rig local mínimo solo durante
la separación de SRB y etapa central. No se carga otro modelo de cohete.

## Pantallas

- DU1: ruta, cuerpos, posición, hito y escala.
- DU2: altitud, velocidad, aceleración, actitud, potencia, combustible y etapa.
- DU3: motores, SRB, ICPS, Orion, energía, comunicaciones y alertas.

Las tres DUs leen el mismo `MissionModel`. Los focos F1, F2 y F3 conservan la
cabina visible; `Escape` vuelve al encuadre general.

## Cámara y vuelo

Botón derecho + arrastre mueve la mirada solo dentro de Cabina. Cabina e Instrumentos
no cambian la cámara ni el zoom de Exterior. La RenderTexture de las ventanas muestra
el mismo cuerpo, fase y ambiente que Exterior.

La física, separación y alunizaje son didácticos. NASA no patrocina ni certifica el
simulador.
