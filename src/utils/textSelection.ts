/**
 * Waar zodra de gebruiker net tekst heeft geselecteerd. Een sleep om tekst te
 * selecteren eindigt met een gewone click; die moet geen stop selecteren of
 * een activiteit openklappen.
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}
