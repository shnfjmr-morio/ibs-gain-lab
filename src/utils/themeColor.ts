const STATUS_THEME_COLORS: Record<string, string> = {
  stable:     '#0D3B36',
  mild:       '#3D2E0A',
  active:     '#3D1219',
  recovering: '#1E1740',
}

export function updateThemeColor(ibsStatus: string) {
  const color = STATUS_THEME_COLORS[ibsStatus] ?? STATUS_THEME_COLORS.stable
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', color)
}
