type NotesPanelProps = {
  dateLabel: string;
  value: string;
  onChange: (next: string) => void;
};

export const NotesPanel = ({ dateLabel, value, onChange }: NotesPanelProps) => {
  return (
    <section className="notes-shell">
      <header className="notes-header">
        <h3>Notes</h3>
        <p>{dateLabel}</p>
      </header>
      <textarea
        className="notes-editor"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Write notes for ${dateLabel}.\n\n- Bullet points\n- Tasks\n- Meeting notes`}
      />
    </section>
  );
};
