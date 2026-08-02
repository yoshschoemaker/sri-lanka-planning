export function OpenQuestions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-terracotta/25 bg-terracotta/5 p-5 sm:p-6">
      <h2 className="font-serif text-lg font-semibold text-terracotta-dark">Nog te bespreken</h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {questions.map((question) => (
          <li key={question} className="flex items-start gap-2 text-sm text-ink-soft">
            <span aria-hidden className="mt-0.5 text-terracotta">
              ?
            </span>
            {question}
          </li>
        ))}
      </ul>
    </div>
  );
}
