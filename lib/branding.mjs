export function luminance(hex) {
    const channels = hex.slice(1).match(/../g).map(n => parseInt(n, 16) / 255).map(n => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export function brandColors(value) {
    const accent = /^#[a-f0-9]{6}$/i.test(value ?? '') ? value : '#b85b30';
    return { accent, text: contrast(accent, '#ffffff') >= 4.5 ? '#ffffff' : '#15271d', link: contrast(accent, '#ffffff') >= 4.5 ? accent : '#65401e' };
}
