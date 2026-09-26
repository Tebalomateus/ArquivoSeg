// Uso de armazenamento no modo demonstração. Não há arquivos de verdade, então
// cada sinistro da demo ganha um tamanho estável, derivado do id — o mesmo a
// cada recarga — na forma de getStorageUsage (src/api/storage.js).

function hash(str) {
    let h = 0x811c9dc5;
    for (const ch of String(str)) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
}

const MB = 1024 * 1024;

export async function mockGetStorageUsage(claims = []) {
    await new Promise((r) => setTimeout(r, 120));
    const processes = claims
        .map((c) => {
            const h = hash(c.id);
            return {
                process_id: String(c.id),
                title: c.title || c.number || String(c.id),
                bytes: (40 + (h % 440)) * MB + (h % 1024) * 1024,
                file_count: 8 + (h % 40),
            };
        })
        .sort((a, b) => b.bytes - a.bytes);
    return {
        data: {
            total_bytes: processes.reduce((s, p) => s + p.bytes, 0),
            file_count: processes.reduce((s, p) => s + p.file_count, 0),
            processes,
        },
    };
}
