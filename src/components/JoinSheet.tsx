import { useEffect, useState, type FormEvent } from "react";
import { useCommunity } from "../utils/communityContext";
import { INPUT_CLASS_NAME, PRIMARY_BUTTON_CLASS_NAME, Sheet, SheetField } from "./Sheet";

interface JoinSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Meedoen met de groep: een naam en de groepscode. Wie al lid is, ziet hier
 * alleen het naamveld om die te wijzigen. De code wordt op de server
 * gecontroleerd; zonder code kun je alles zien maar niets plaatsen.
 */
export function JoinSheet({ open, onClose }: JoinSheetProps) {
  const { username, join, rename } = useCommunity();
  const isMember = username !== null;
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(username ?? "");
    setCode("");
    setError(null);
  }, [open, username]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || (!isMember && !code.trim())) return;
    setBusy(true);
    const result = isMember ? await rename(name) : await join(code, name);
    setBusy(false);
    if (result) setError(result);
    else onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isMember ? "Je naam" : "Meedoen"}
      subtitle={
        isMember
          ? "Zo zien je reisgenoten wie wat voorstelt."
          : "Met de groepscode kun je activiteiten voorstellen, duimpjes geven en je eigen prioriteit kiezen."
      }
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
        <SheetField label="Naam">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            autoComplete="given-name"
            required
            className={INPUT_CLASS_NAME}
          />
        </SheetField>
        {!isMember && (
          <SheetField label="Groepscode" hint="Vraag de code aan een van je reisgenoten.">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={INPUT_CLASS_NAME}
            />
          </SheetField>
        )}

        {error && (
          <p role="alert" className="text-sm text-terracotta-dark">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS_NAME}>
            {busy ? "Bezig…" : isMember ? "Opslaan" : "Meedoen"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
