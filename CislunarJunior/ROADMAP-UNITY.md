# Roadmap Unity - Cislunar Junior

## Hecho en la vertical slice

- Proyecto Unity 2022.3 desde cero.
- Escena procedural con cabina, consola, tres DUs, ventana, plataforma, torre y cohete.
- Perfiles Artemis II extendida, alunizaje y Marte.
- Vuelo libre sin decisiones obligatorias.
- Cámaras separadas para Cabina, Exterior, Ruta e Instrumentos.
- Mirada con botón derecho + arrastre y límites de orientación.
- Tutorial inicial y controles visibles.
- Paquete mcp-unity declarado y configuración Codex local.

## Etapa actual

- Ventana frontal con RenderTexture del exterior y cámara aislada.
- Telemetría ampliada: aceleración, velocidades vertical/horizontal, delta-v,
  presión dinámica, temperatura, etapa y comunicaciones.
- Vuelo libre con transición automática de plataforma a ascenso y órbita.
- Orion FBX `Orion_ArtemisII.fbx` convertido desde `NASA-source/user-provided/orion-spacecraft.zip`.
- SLS usa `Artemis2_reference.fbx` y `Artemis2_SLS.png`, copias exactas de
  `NASA-source/user-provided/nasa-artemis-ii-space-launch-system-sls.zip`.
- El importador SLS conserva jerarquía FBX y la geometría fallback incluye tanque
  naranja, intertanque, faldón de motores RS-25, sólidos, ICPS, Orion/LAS y torre
  separada con proporción de plataforma.
- Cuando el FBX SLS oficial llega monolítico, el controlador conserva ese FBX en
  plataforma y ascenso; usa un rig auxiliar alineado solo para separar SRB y etapa central.
- La cámara Exterior centra el vehículo completo y separa torre, plataforma y
  cohete; la cabina usa el mismo entorno exterior en su RenderTexture.
- El encuadre Exterior usa bounds del vehículo activo y ajusta distancia en 16:9,
  4:3 y ventanas estrechas; la RenderTexture frontal conserva proporción panorámica.
- La plataforma tiene raíles, bordes de trinchera y horizonte atmosférico dinámico.
- `LaunchVehicleController` separa visualmente SRB, etapa central, Orion y módulo
  lunar; anima torre, plume, humo, paneles y cambio de vehículo por fase.
- MissionModel conserva throttle, actitud, delta-v, autorización de separación y
  `LaunchVehicleState` sin duplicar el estado de vuelo.
- Línea de lanzamiento explícita: cuenta regresiva de 10 s, encendido, liftoff,
  ascenso, separación SRB condicionada, separación de etapa condicionada e ICPS.
- Navegación dinámica compartida por DU1, Ruta y HUD: segmento, siguiente maniobra,
  distancia, error de trayectoria, delta-v, tiempo y corrección asistida.
- Botones `EJECUTAR MANIOBRA` y `CORREGIR RUTA` con consumo educativo y validación
  de combustible/hito.
- Cámara Exterior suavizada y zoom independiente para Ruta y Exterior.
- Se añadieron pruebas EditMode para eventos SRB, etapa central y vuelo libre, además
  de pruebas PlayMode para el stack híbrido.
- Build Windows generada en `Builds/Windows/CislunarJunior-Orion.exe`; el smoke test
  de Player.log terminó sin excepciones.

## Siguiente etapa

1. Validar la importación del paquete mcp-unity en Unity 2022.3 o fijar una revisión compatible.
2. Normalizar el FBX SLS oficial y sustituir la geometría local cuando sus ejes y
   proporciones pasen la validación automática.
3. Convertir cada DU en una pantalla física con material emisivo, cristal y datos por perfil.
4. Añadir selección de perfil en menú y guardado de misión.
5. Sustituir ruta procedural por mapa heliocéntrico con órbitas, ruta y escala esquemática más detalladas.
6. Añadir humo, fuego, atmósferas, separación de etapas y terreno lunar/marciano.
7. Añadir pruebas de escena, cámara, vuelo libre y telemetría.
8. Revisar 16:9, 4:3 y ventana estrecha.

## Riesgos conocidos

- Unity 6000.6.6f1 compila scripts en batch; la ejecución automática del Test Runner no produjo XML en este entorno.
- La compatibilidad exacta de mcp-unity con Unity 2022.3 debe confirmarse al abrir el proyecto en Unity Hub.
- La malla SLS oficial todavía puede conservar ejes inválidos; runtime intenta
  cargarla y cae a la geometría local separable si falla la validación.
