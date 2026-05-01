export interface ThemeColor {
    id: string;
    value: number; // Hex number 0xRRGGBB
    label: string;
}

export const THINKOFF_COLORS: ThemeColor[] = [
    { id: "lightpink", value: 0xFFAADD, label: "Light Pink" },
    { id: "fuchsia", value: 0xFF77FF, label: "Fuchsia" }, // Android was 0xFFFF77FF (ARGB), Web is RGB
    { id: "hotpink", value: 0xFF00FF, label: "Hot Pink" },
    { id: "magenta", value: 0xCC00CC, label: "Magenta" },
    { id: "orange", value: 0xFF9900, label: "Orange" },
    { id: "yellow", value: 0xFFDD00, label: "Gold" },
    { id: "lime", value: 0x99DD00, label: "Lime" },
    { id: "green", value: 0x55AA00, label: "Green" }
];

export const DEFAULT_COLOR = THINKOFF_COLORS[2]; // Hot Pink
