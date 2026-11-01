import { useEffect, useState, type FormEvent } from "react";
import type { Stop } from "../types/trip";
import { useCommunity } from "../utils/communityContext";
import { INPUT_CLASS_NAME, PRIMARY_BUTTON_CLASS_NAME, Sheet, SheetField } from "./Sheet";

interface SuggestSheetProps {
  /** De stop waar het voorstel bij hoort; null houdt de sheet dicht. */
  stop: Stop | null;
  onClose: () => void;
}

/** Een activiteit voorstellen bij een stop. Werkt ook offline: het voorstel wacht dan tot er bereik is. */
export function SuggestSheet({ stop, onClose }: SuggestSheetProps) {
  const { addSuggestion } = useCommunity();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!stop) return;
    setTitle("");
    setDescription("");
    setUrl("");
  }, [stop]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stop || !title.trim()) return;
    addSuggestion({
      stopId: stop.id,
      title: title.trim(),
      description: description.trim() || null,
      url: url.trim() || null,
    });
    onClose();
  }

  return (
    <Sheet open={stop !== null} onClose={onClose} title="Activiteit voorstellen" subtitle={stop ? `Bij ${stop.name}` : undefined}>
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <SheetField label="Wat">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Bijvoorbeeld: Kookles bij een gastgezin"
            required
            className={INPUT_CLASS_NAME}
          />
        </SheetField>
        <SheetField label="Toelichting" hint="Optioneel">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={3}
            className={`${INPUT_CLASS_NAME} resize-none`}
          />
        </SheetField>
        <SheetField label="Link" hint="Optioneel, bijvoorbeeld een website of Google Maps">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={500}
            placeholder="https://"
            pattern="https?://.+"
            className={INPUT_CLASS_NAME}
          />
        </SheetField>

        <div className="flex justify-end">
          <button type="submit" className={PRIMARY_BUTTON_CLASS_NAME}>
            Voorstellen
          </button>
        </div>
      </form>
    </Sheet>
  );
}
