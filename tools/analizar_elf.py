"""
Analisis de libil2cpp.so (ELF ARM64) para IL2CPP
Canon Labs - Cislunar Junior

Comprueba que la logica del juego esta compilada a codigo nativo ARM64
y que NO existe codigo fuente C# recuperable.
"""
import struct
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ELF_MAGIC = b'\x7fELF'
EM_AARCH64 = 183


def analizar_elf(ruta):
    with open(ruta, 'rb') as f:
        datos = f.read()

    print(f"Archivo:  {ruta}")
    print(f"Tamano:   {len(datos):,} bytes ({len(datos)/1024/1024:.1f} MB)")

    if datos[:4] != ELF_MAGIC:
        print("ERROR: no es un archivo ELF")
        return

    ei_class = datos[4]   # 1=32bit, 2=64bit
    ei_data = datos[5]    # 1=little, 2=big
    e_machine = struct.unpack_from('<H', datos, 18)[0]

    print(f"Clase:    {'64 bits' if ei_class == 2 else '32 bits'}")
    print(f"Orden:    {'little-endian' if ei_data == 1 else 'big-endian'}")
    nombres = {3: 'x86', 40: 'ARM', 62: 'x86-64', 183: 'AArch64 (ARM64)'}
    print(f"Arquitectura: {nombres.get(e_machine, e_machine)}")

    if e_machine != EM_AARCH64:
        print("\nAVISO: se esperaba AArch64 para Android arm64-v8a")

    # Cabeceras de seccion (ELF64: e_shoff en 0x28, e_shentsize 0x3A, e_shnum 0x3C)
    e_shoff = struct.unpack_from('<Q', datos, 0x28)[0]
    e_shentsize = struct.unpack_from('<H', datos, 0x3A)[0]
    e_shnum = struct.unpack_from('<H', datos, 0x3C)[0]
    e_shstrndx = struct.unpack_from('<H', datos, 0x3E)[0]

    print(f"\nSecciones: {e_shnum}  (offset tabla = {e_shoff:,})")

    # Leer la tabla de nombres de seccion
    def shdr(i):
        p = e_shoff + i * e_shentsize
        return struct.unpack_from('<IIQQQQIIQQ', datos, p)

    _, _, _, _, shstr_off, shstr_size, _, _, _, _ = shdr(e_shstrndx)
    nombres_sh = datos[shstr_off:shstr_off + shstr_size]

    print("\n--- Secciones relevantes ---")
    total_ejecutable = 0
    for i in range(e_shnum):
        nm, tp, fl, ad, off, sz, _, _, _, _ = shdr(i)
        fin = nombres_sh.find(b'\x00', nm)
        nombre = nombres_sh[nm:fin].decode('ascii', errors='replace') if fin > 0 else '?'
        if nombre in ('.text', '.plt', '.rodata', '.data', '.bss'):
            marca = '  <-- LOGICA' if nombre == '.text' else ''
            print(f"  {nombre:<12} offset={off:>10,}  tam={sz:>12,}{marca}")
            if nombre in ('.text', '.plt'):
                total_ejecutable += sz

    print(f"\nCodigo nativo compilado: {total_ejecutable:,} bytes "
          f"({total_ejecutable/1024/1024:.1f} MB)")

    # ---- Comprobar si hay codigo fuente legible (no deberia haberlo) ----
    print("\n--- Buscando codigo fuente C# ---")
    firmas = [b'using System', b'namespace Ellipse', b'public class',
              b'private void', b'// </auto-generated>', b'm_Il2CppMethod']
    encontradas = 0
    for f in firmas:
        n = datos.count(f)
        if n:
            print(f"  '{f.decode(errors='replace')}': {n} apariciones")
            encontradas += n

    if encontradas == 0:
        print("  Ninguna firma de C# encontrada.")
        print("  CONFIRMADO: no hay codigo fuente en la biblioteca.")

    # ---- Estimar cantidad de funciones ----
    # En AArch64, los 'ret' (0xd65f03c0) marcan finales de funcion
    ret = b'\xc0\x03\x5f\xd6'
    n_func = datos.count(ret)
    print(f"\nInstrucciones 'ret' (fin de funcion ARM64): {n_func:,}")
    print(f"Funciones estimadas: ~{n_func:,}")

    # ---- Proporcion de texto vs binario ----
    printable = sum(1 for b in datos if 32 <= b < 127)
    print(f"\nBytes imprimibles: {printable/len(datos)*100:.1f}%")
    print(f"Bytes binarios:    {(1-printable/len(datos))*100:.1f}%")


if __name__ == '__main__':
    import sys as _s
    analizar_elf(_s.argv[1] if len(_s.argv) > 1 else 'libil2cpp.so')