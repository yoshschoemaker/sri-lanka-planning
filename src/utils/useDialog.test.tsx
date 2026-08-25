import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { useDialog } from "./useDialog";

/** Minimale dialoog die alleen de hook uitoefent. */
function Dialog({
  open,
  onClose,
  trapFocus,
  label = "dialoog",
}: {
  open: boolean;
  onClose: () => void;
  trapFocus?: boolean;
  label?: string;
}) {
  const ref = useDialog<HTMLDivElement>({ open, onClose, trapFocus });
  if (!open) return null;
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-label={label}>
      <button type="button">eerste</button>
      <button type="button">tweede</button>
      <button type="button">derde</button>
    </div>
  );
}

/** Opener plus dialoog, zodat het teruggeven van de focus te controleren is. */
function Harness({ trapFocus }: { trapFocus?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        openen
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} trapFocus={trapFocus} />
    </>
  );
}

/** useDialog zet de focus in een requestAnimationFrame, dus daar moet een test op wachten. */
function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
}

describe("useDialog, sluiten", () => {
  it("sluit op Escape", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reageert niet op Escape als de dialoog dicht is", () => {
    const onClose = vi.fn();
    render(<Dialog open={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("laat andere toetsen los", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} />);
    fireEvent.keyDown(document, { key: "a" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("useDialog, scroll-lock", () => {
  it("zet de pagina vast zolang de dialoog open is", () => {
    const { unmount } = render(<Dialog open onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("houdt de lock tot de laatste dialoog dicht is", () => {
    // De lightbox opent bovenop een uitgeklapte stop, en de instellingen bovenop
    // de kaart. Met alleen opslaan en terugzetten per dialoog haalde de bovenste
    // bij het sluiten de lock van de onderliggende weg.
    const buiten = render(<Dialog open onClose={() => {}} label="buitenste" />);
    const binnen = render(<Dialog open onClose={() => {}} label="binnenste" />);
    expect(document.body.style.overflow).toBe("hidden");
    binnen.unmount();
    expect(document.body.style.overflow).toBe("hidden");
    buiten.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("useDialog, focus", () => {
  it("zet de focus bij openen in de dialoog", async () => {
    render(<Dialog open onClose={() => {}} />);
    await nextFrame();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "eerste" }));
  });

  it("geeft de focus bij sluiten terug aan wat hem opende", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "openen" });
    opener.focus();
    fireEvent.click(opener);
    await nextFrame();
    expect(document.activeElement).not.toBe(opener);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(opener);
  });

  it("eist de focus niet op als trapFocus uit staat", async () => {
    // Wat de splash krijgt: wel een scroll-lock, maar het is geen dialoog.
    render(<Harness trapFocus={false} />);
    const opener = screen.getByRole("button", { name: "openen" });
    opener.focus();
    fireEvent.click(opener);
    await nextFrame();
    expect(document.activeElement).toBe(opener);
  });

  it("lust met Tab door van de laatste naar de eerste", async () => {
    render(<Dialog open onClose={() => {}} />);
    await nextFrame();
    const derde = screen.getByRole("button", { name: "derde" });
    derde.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "eerste" }));
  });

  it("lust met shift+Tab van de eerste naar de laatste", async () => {
    render(<Dialog open onClose={() => {}} />);
    await nextFrame();
    screen.getByRole("button", { name: "eerste" }).focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "derde" }));
  });

  it("haalt de focus terug als hij buiten de dialoog is beland", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "openen" });
    fireEvent.click(opener);
    await nextFrame();
    opener.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "eerste" }));
  });
});
