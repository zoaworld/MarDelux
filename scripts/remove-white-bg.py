"""
Remove fundo branco de PNGs do logotipo MarDelux.
Preserva o conteúdo dourado e torna o fundo transparente.
Uso: python scripts/remove-white-bg.py [pasta_entrada] [pasta_saida]
"""
from pathlib import Path
import sys

try:
    from PIL import Image
except ImportError:
    print("Instala Pillow: pip install Pillow")
    sys.exit(1)


def _is_white_neutral(r: int, g: int, b: int, lum_min: int = 246, sat_max: int = 18) -> bool:
    """Considera branco só pixels claros e neutros (sem cor). Preserva dourado (tem saturação)."""
    if r < lum_min or g < lum_min or b < lum_min:
        return False
    spread = max(r, g, b) - min(r, g, b)
    return spread <= sat_max


def _is_nearly_white_fringe(r: int, g: int, b: int, lum_min: int = 232, sat_max: int = 38) -> bool:
    """
    Pixels de transição branco/dourado (franja). Só removemos junto a transparência.
    Dourado típico tem saturação alta (R>G>B, spread grande), por isso não é tocado.
    """
    if r < lum_min or g < lum_min or b < lum_min:
        return False
    spread = max(r, g, b) - min(r, g, b)
    return spread <= sat_max


def _defringe_edge_pixels(pixels_2d: list, w: int, h: int) -> None:
    """
    Remove franja: pixels ainda opacos que são 'quase brancos' e têm vizinho transparente.
    Várias iterações para remover várias camadas de halo branco.
    """
    for _ in range(6):  # mais iterações para eliminar franja visível
        changed = False
        next_pixels = [row[:] for row in pixels_2d]
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels_2d[y][x]
                if a == 0:
                    continue
                if not _is_nearly_white_fringe(r, g, b):
                    continue
                # Tem algum vizinho transparente?
                has_transparent = False
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and pixels_2d[ny][nx][3] == 0:
                            has_transparent = True
                            break
                    if has_transparent:
                        break
                if has_transparent:
                    next_pixels[y][x] = (255, 255, 255, 0)
                    changed = True
        pixels_2d[:] = next_pixels
        if not changed:
            break


def remove_white_background(image_path: Path, output_path: Path) -> None:
    """
    1) Remove branco neutro (fundo).
    2) Descontamina bordas: remove apenas franja (quase branco junto a transparência).
    Preserva o dourado; dourado tem saturação e não é 'quase branco'.
    """
    img = Image.open(image_path).convert("RGBA")
    w, h = img.size
    data = list(img.getdata())

    # Passo 1: fundo branco neutro -> transparente
    new_data = []
    for item in data:
        r, g, b, a = item
        if _is_white_neutral(r, g, b):
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)

    # Passo 2: descontaminar franja (só pixels quase brancos que tocam em transparência)
    pixels_2d = [list(new_data[i * w : (i + 1) * w]) for i in range(h)]
    _defringe_edge_pixels(pixels_2d, w, h)
    new_data = [pixel for row in pixels_2d for pixel in row]

    img.putdata(new_data)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG")
    print(f"  OK: {output_path.name}")


# Os 3 logos MarDelux (texto, lótus, completo)
LOGO_FILES = [
    "image-12dcd7b3-841f-4ccc-9b73-f03bfef6074a.png",  # MarDelux texto
    "image-468a3e27-c9e0-438c-8e55-a8d5d0263cb2.png",  # Lótus
    "image-a14242b4-331e-453c-9c4b-954dc9110a24.png",  # Lótus + MarDelux
]
OUT_NAMES = ["logo-texto.png", "logo-lotus.png", "logo-completo.png"]


def main():
    base = Path(__file__).resolve().parent.parent
    input_dir = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else base / "assets"
    output_dir = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else base / "public" / "logo"

    # Encontrar os 3 logos (por nome ou fim do nome) em qualquer subpasta
    all_pngs = list(input_dir.rglob("*.png"))
    found = []
    for name in LOGO_FILES:
        for p in all_pngs:
            if p.name == name or p.name.endswith("_" + name) or p.name.endswith(name):
                found.append(p)
                break

    if len(found) != 3:
        # Fallback: processar todos os PNGs da pasta
        pngs = sorted(input_dir.rglob("*.png"), key=lambda p: p.name)
        if not pngs:
            print(f"Nenhum PNG em: {input_dir}")
            print("Uso: python scripts/remove-white-bg.py [pasta_entrada] [pasta_saida]")
            sys.exit(1)
        found = pngs[:3]
        out_names = [f"logo-{i+1}.png" for i in range(len(found))]
        print(f"(A usar primeiros 3 PNGs por nome; para os 3 logos use a pasta com os ficheiros corretos.)")
    else:
        # Ordenar: texto, lótus, completo
        def order_key(p):
            for i, n in enumerate(LOGO_FILES):
                if p.name == n or p.name.endswith("_" + n) or p.name.endswith(n):
                    return i
            return 99
        found.sort(key=order_key)
        out_names = OUT_NAMES

    print(f"Entrada: {input_dir}")
    print(f"Saída: {output_dir}")
    for png, out_name in zip(found, out_names):
        remove_white_background(png, output_dir / out_name)
    print("Concluído.")


if __name__ == "__main__":
    main()
