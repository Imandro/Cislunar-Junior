# Análisis técnico del APK de referencia

**Cañon Labs · Cislunar Junior**
Método y resultados de la fase de investigación previa al desarrollo.

---

## Qué se analizó

| Archivo | Tamaño | Contenido |
|---|---|---|
| `global-metadata.dat` | 7,69 MB | Tabla de metadatos IL2CPP (nombres de clases, métodos y rutas) |
| `libil2cpp.so` | 48,37 MB | Biblioteca nativa ARM64 con el juego compilado |

Herramientas propias escritas para el análisis, en `tools/`:
- `leer_metadata.py` — parser del encabezado y tablas de `global-metadata.dat`
- `analizar_elf.py` — lector de secciones ELF64/AArch64

---

## Resultado: por qué el código no se puede recuperar

### El código no está en formato recuperable

```
Arquitectura:      AArch64 (ARM64)
Código nativo:      2,5 MB en la sección .text
Funciones estimadas: ~120.298
Bytes binarios:      80,5 %
```

**Búsqueda de firmas de C#:**

```
using System        → 0 apariciones
namespace Ellipse   → 0 apariciones
public class        → 0 apariciones
private void        → 0 apariciones
```

**No existe código fuente.** El juego fue compilado con IL2CPP: el C# se
traduce a código máquina ARM64 antes de empaquetarse. Una función C# de 10
líneas ocupa cientos de bytes de instrucciones opacas.

### Lo único recuperable: metadatos

327 declaraciones de métodos y 180+ rutas de scripts, por ejemplo:

```
Assets\Scripts\Physics\KeplerMath.cs
Assets\Scripts\Physics\OrbitalElements.cs
Assets\Scripts\LaunchFunctions\RocketManagement.cs
Assets\Scripts\PartsFunctions\FuelTank.cs
Assets\Scripts\FluidDynamics.cs
```

Son **nombres**, no implementaciones. Dicen qué sistemas existen, no cómo funcionan.

---

## Lo que sí aportó el análisis

Una **especificación de arquitectura**: saber qué módulos tiene un simulador
espacial serio permite construir los nuestros con la física pública
correspondiente.

| Sistema identificado en el APK | Reimplementado en |
|---|---|
| `KeplerMath`, `OrbitalElements`, `KeplerEllipseRenderer` | `js/orbital.js` |
| `RocketManagement`, `Staging`, `FuelTank`, `RocketEngine` | `js/vehiculo.js` |
| `SplashScreen`, `UIFade`, `AnimatedWindow` | `js/arranque.js` |
| `ConstructionBase`, `SymmetryMode`, `Part` | `js/laboratorio.js` |
| `FluidDynamics`, `FluidSystem`, `Chemistry` | *pendiente* |

**Líneas de código del APK reutilizadas: 0.**
Cada fórmula (vis-viva, Tsiolkovski, Kepler, Newton-Raphson) procede de
la física pública, no del APK.

---

## Conclusión

Buscar código reutilizable en un APK con IL2CPP fue tiempo perdido, y esta
documentación existe para que no se repita. El análisis sí fue útil como
mapa de sistemas, que es exactamente lo que se leveraged: definir qué construir
antes de construirlo.

---

## Referencias

- Unity IL2CPP: https://docs.unity3d.com/Manual/IL2CPP.html
- Physics used: vis-viva equation, Tsiolkovsky rocket equation,
  Kepler's laws, Newton-Raphson method (all public domain)
- NASA open data: https://images.nasa.gov