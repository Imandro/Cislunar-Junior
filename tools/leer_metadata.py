"""
Lector de global-metadata.dat (Unity IL2CPP)
Analisis tecnico del APK para Cislunar Junior / Canon Labs.
Herramienta propia escrita desde cero en Python.

Solo extrae METADATOS (nombres, indices, offsets). No genera codigo
ejecutable ni descompila IL2CPP a C#.
"""
import struct
import sys

# Forzar salida UTF-8 en la consola de Windows
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

MAGIC = 0xAF1BB1FA  # version >= 24

# Indices de las tablas en el encabezado (version 27-29)
IDX = {
    24: dict(stringLiteral=1, stringLiteralData=2, string=3, events=4,
             properties=5, methods=6, parameterDefaultValues=7,
             fieldDefaultValues=8, fieldAndParameterDefaultValueData=9,
             fieldMarshaledSizes=10, parameters=11, fields=12,
             genericParameters=13, genericParameterConstraints=14,
             genericContainers=15, nestedTypes=16, interfaces=17,
             vtableMethods=18, interfaceOffsets=19, typeDefinitions=20,
             images=22, assemblies=23, metadataUsageLists=24,
             metadataUsagePairs=25, fieldRefs=26, referencedAssemblies=27,
             attributeInfo=28, attributeTypes=29),
    27: dict(stringLiteral=1, stringLiteralData=2, string=3, events=4,
             properties=5, methods=6, parameterDefaultValues=7,
             fieldDefaultValues=8, fieldAndParameterDefaultValueData=9,
             fieldMarshaledSizes=10, parameters=11, fields=12,
             genericParameters=13, genericParameterConstraints=14,
             genericContainers=15, nestedTypes=16, interfaces=17,
             vtableMethods=18, interfaceOffsets=19, typeDefinitions=20,
             images=24, assemblies=25, metadataUsageLists=26,
             metadataUsagePairs=27, fieldRefs=28, referencedAssemblies=29,
             attributeInfo=30, attributeTypes=31),
    29: dict(stringLiteral=1, stringLiteralData=2, string=3, events=4,
             properties=5, methods=6, parameterDefaultValues=7,
             fieldDefaultValues=8, fieldAndParameterDefaultValueData=9,
             fieldMarshaledSizes=10, parameters=11, fields=12,
             genericParameters=13, genericParameterConstraints=14,
             genericContainers=15, nestedTypes=16, interfaces=17,
             vtableMethods=18, interfaceOffsets=19, typeDefinitions=20,
             images=24, assemblies=25, metadataUsageLists=26,
             metadataUsagePairs=27, fieldRefs=28, referencedAssemblies=29,
             attributeInfo=30, attributeTypes=31),
    # Unity 2021+: el encabezado sigue igual pero hay tablas adicionales
    30: dict(stringLiteral=1, stringLiteralData=2, string=3, events=4,
             properties=5, methods=6, parameterDefaultValues=7,
             fieldDefaultValues=8, fieldAndParameterDefaultValueData=9,
             fieldMarshaledSizes=10, parameters=11, fields=12,
             genericParameters=13, genericParameterConstraints=14,
             genericContainers=15, nestedTypes=16, interfaces=17,
             vtableMethods=18, interfaceOffsets=19, typeDefinitions=20,
             images=24, assemblies=25, metadataUsageLists=26,
             metadataUsagePairs=27, fieldRefs=28, referencedAssemblies=29,
             attributeInfo=30, attributeTypes=31),
    31: dict(stringLiteral=1, stringLiteralData=2, string=3, events=4,
             properties=5, methods=6, parameterDefaultValues=7,
             fieldDefaultValues=8, fieldAndParameterDefaultValueData=9,
             fieldMarshaledSizes=10, parameters=11, fields=12,
             genericParameters=13, genericParameterConstraints=14,
             genericContainers=15, nestedTypes=16, interfaces=17,
             vtableMethods=18, interfaceOffsets=19, typeDefinitions=20,
             images=24, assemblies=25, metadataUsageLists=26,
             metadataUsagePairs=27, fieldRefs=28, referencedAssemblies=29,
             attributeInfo=30, attributeTypes=31),
}

# Tamano en bytes de cada struct de las tablas que nos interesan
TAM_METODO = 0x1C      # MethodDefinition
TAM_TIPO = 0x64         # TypeDefinition (v24+)
TAM_CAMPO = 0x08        # FieldDefinition


def leer_cadena(datos, offset):
    """Lee una cadena null-terminated en UTF-8."""
    if offset <= 0 or offset >= len(datos):
        return ""
    fin = datos.index(b'\x00', offset) if b'\x00' in datos[offset:] else len(datos)
    return datos[offset:fin].decode('utf-8', errors='replace')


def analizar(ruta):
    with open(ruta, 'rb') as f:
        datos = f.read()

    if len(datos) < 64:
        print("ERROR: archivo demasiado pequeno")
        return None

    magic = struct.unpack_from('<I', datos, 0)[0]
    version = struct.unpack_from('<I', datos, 4)[0]
    print(f"Magic:        0x{magic:08X}")
    print(f"Version:      {version}")
    print(f"Tamano:       {len(datos):,} bytes")

    # El magic se guarda little-endian: 0xAF1BB1FA se lee como 0xFAB11BAF
    if magic not in (MAGIC, MAGIC >> 24 | (MAGIC & 0xFFFFFF00)):
        # comparacion flexible por byte
        b = struct.pack('<I', MAGIC)
        if datos[:4] != b and datos[:4] != struct.pack('>I', MAGIC):
            print("\nAVISO: magic no reconocido.")
            return None

    if version > 31:
        print(f"\nAVISO: version {version} mas nueva que la documentada (31).")
        print("       Las tablas pueden estar desplazadas; se continuara en modo lenient.")
        return None

    tabla = IDX.get(version)
    if tabla is None:
        print(f"\nVersion {version} sin tabla de indices conocida.")
        return None

    print(f"\nEstructura conocida para v{version}: OK")

    # ---- Encabezado de tablas ----
    # Cada entrada del encabezado es un par (offset: int32, bytes: int32)
    offset_tabla = {}
    for clave, indice in tabla.items():
        pos = 8 + (indice * 2) * 4
        if pos + 8 <= len(datos):
            off, cant = struct.unpack_from('<iI', datos, pos)
            if 0 < off < len(datos) and cant > 0:
                offset_tabla[clave] = (off, cant)

    print(f"Tablas localizadas: {len(offset_tabla)}")
    for clave in ('string', 'methods', 'typeDefinitions', 'fields'):
        if clave in offset_tabla:
            off, cant = offset_tabla[clave]
            print(f"  {clave:<18} offset={off:>10,}  tam={cant:>12,} bytes")

    # ---- Tabla de cadenas ----
    if 'string' not in offset_tabla:
        return None
    off_str, bytes_str = offset_tabla['string']

    def cadena(idx):
        """Lee la cadena de indice `idx` dentro de la tabla."""
        pos = off_str + idx * 4
        if pos + 4 > len(datos):
            return ""
        # el indice apunta al final de la cadena; retrocedemos hasta el inicio
        ini = pos
        while ini > off_str and datos[ini - 1] != 0:
            ini -= 1
        if ini >= pos:
            return ""
        return leer_cadena(datos, ini)

    # ---- Metodos: extraer nombre con su declarante ----
    metodos = []
    if 'methods' in offset_tabla:
        off_m, bytes_m = offset_tabla['methods']
        n_met = bytes_m // TAM_METODO
        print(f"\nMetodos declarados: {n_met:,}")
        for i in range(n_met):
            p = off_m + i * TAM_METODO
            if p + TAM_METODO > len(datos):
                break
            # MethodDefinition: nameIndex(int32) declaringType(int16) ...
            name_idx = struct.unpack_from('<i', datos, p)[0]
            decl_type = struct.unpack_from('<h', datos, p + 4)[0]
            nombre = cadena(name_idx)
            if nombre and len(nombre) < 120:
                metodos.append((nombre, decl_type))

    print(f"Metodos con nombre legible: {len(metodos):,}")
    if metodos:
        print("\n--- Muestra de 25 metodos ---")
        for n, t in metodos[:25]:
            print(f"  {n}")

    # ---- Scripts del juego (rutas Assets) ----
    print("\n--- Scripts del juego (rutas de Assets) ---")
    scripts = []
    for nombre, _ in metodos:
        # Los nombres de script aparecen como ruta completa en el metadata
        pass

    # Escaneo directo de firmas en todo el archivo
    buscar = [b'Assets\\Scripts\\']
    for firma in buscar:
        pos = 0
        while True:
            p = datos.find(firma, pos)
            if p == -1:
                break
            fin = datos.find(b'\x00', p)
            ruta = datos[p:fin].decode('utf-8', errors='replace')
            if ruta not in scripts:
                scripts.append(ruta)
            pos = fin + 1

    scripts.sort()
    for s in scripts:
        print("  " + s)
    print(f"\nTOTAL scripts propios: {len(scripts)}")

    return {'metodos': metodos, 'scripts': scripts, 'tablas': offset_tabla}


if __name__ == '__main__':
    ruta = sys.argv[1] if len(sys.argv) > 1 else 'global-metadata.dat'
    r = analizar(ruta)
    if r:
        print("\n--- Scripts propios del juego ---")
        for s in sorted(r):
            print("  " + s)