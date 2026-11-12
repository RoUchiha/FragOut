export function bannerFrameProps(visible: boolean) {
  if (visible) {
    return {
      style: {position: 'relative', alignItems: 'center', marginTop: 18, marginBottom: 8},
      pointerEvents: 'box-none',
      importantForAccessibility: 'auto',
      accessibilityElementsHidden: false,
    } as const;
  }

  // The SDK can load its view while this frame stays outside the scroll layout.
  return {
    style: {position: 'absolute', left: 0, top: 0, width: '100%', height: 0, opacity: 0, overflow: 'hidden'},
    pointerEvents: 'none',
    importantForAccessibility: 'no-hide-descendants',
    accessibilityElementsHidden: true,
  } as const;
}
