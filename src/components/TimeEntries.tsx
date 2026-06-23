import { useState, type FormEvent } from 'react'
import { useEntries } from '../hooks/useEntries'
import { validateEntryInput, type EntryInput } from '../api/entries'
import type { EntryType, TimeEntry } from '../types/models'

const TYPES: { value: EntryType; label: string }[] = [
  { value: 'work', label: 'Work' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'holiday', label: 'Holiday' },
]

const fmt = (n: number) => Number(n).toFixed(2)

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Render a YYYY-MM-DD as a stable, locale-light label without timezone drift.
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function TimeEntries({ year, month }: { year: number; month: number }) {
  const { data: entries, isLoading, isError, create, update, remove } = useEntries(year, month)

  const [date, setDate] = useState(todayISO())
  const [type, setType] = useState<EntryType>('work')
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const input: EntryInput = {
      entry_date: date,
      entry_type: type,
      // Empty stays undefined so validation asks for it; an explicit "0" is allowed.
      hours_worked: type === 'work' ? (hours.trim() === '' ? undefined : Number(hours)) : undefined,
      notes: notes.trim() || undefined,
    }
    const invalid = validateEntryInput(input)
    if (invalid) {
      setError(invalid)
      return
    }
    try {
      await create.mutateAsync(input)
      setHours('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save this entry.')
    }
  }

  return (
    <section className="entries">
      <header className="entries__head">
        <span className="dash__eyebrow">Log time</span>
        <h2 className="dash__month">Your entries</h2>
      </header>

      <form className="entry-form" onSubmit={onSubmit} noValidate>
        {error && <div className="form__msg form__msg--error">{error}</div>}

        <div className="entry-form__grid">
          <div className="field">
            <label className="field__label" htmlFor="entry-date">
              Date
            </label>
            <input
              id="entry-date"
              className="field__input"
              type="date"
              max={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="entry-type">
              Type
            </label>
            <select
              id="entry-type"
              className="field__input"
              value={type}
              onChange={(e) => setType(e.target.value as EntryType)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Hours field appears only for work entries (SPEC §3). */}
          {type === 'work' && (
            <div className="field">
              <label className="field__label" htmlFor="entry-hours">
                Hours
              </label>
              <input
                id="entry-hours"
                className="field__input"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.25"
                placeholder="0.00"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="entry-notes">
            Notes <span className="field__hint">(optional)</span>
          </label>
          <input
            id="entry-notes"
            className="field__input"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button className="btn btn--primary" type="submit" disabled={create.isPending}>
          {create.isPending ? 'Adding…' : 'Add entry'}
        </button>
      </form>

      <div className="entry-list">
        {isLoading && <p className="dash--muted">Loading entries…</p>}
        {isError && <p className="dash--muted">We couldn’t load your entries. Refresh to retry.</p>}
        {!isLoading && !isError && entries && entries.length === 0 && (
          <p className="dash--muted">No entries yet this month. Log your first above.</p>
        )}
        {!isLoading &&
          !isError &&
          entries?.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onSave={(patch) => update.mutateAsync({ id: entry.id, patch })}
              onDelete={() => remove.mutate(entry.id)}
            />
          ))}
      </div>
    </section>
  )
}

function EntryRow({
  entry,
  onSave,
  onDelete,
}: {
  entry: TimeEntry
  onSave: (patch: { hours_worked?: number; notes?: string | null }) => Promise<unknown>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState(String(entry.hours_worked))
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [error, setError] = useState('')

  const isWork = entry.entry_type === 'work'

  async function save() {
    setError('')
    const patch: { hours_worked?: number; notes?: string | null } = {
      notes: notes.trim() || null,
    }
    if (isWork) {
      const h = Number(hours)
      if (Number.isNaN(h) || h < 0) {
        setError('Hours can’t be negative.')
        return
      }
      if (Math.abs(h * 100 - Math.round(h * 100)) > 1e-9) {
        setError('Use at most two decimal places.')
        return
      }
      patch.hours_worked = h
    }
    try {
      await onSave(patch)
      setEditing(false)
    } catch {
      setError('Couldn’t save. Try again.')
    }
  }

  function cancel() {
    setHours(String(entry.hours_worked))
    setNotes(entry.notes ?? '')
    setError('')
    setEditing(false)
  }

  return (
    <div className="entry">
      <div className="entry__main">
        <span className="entry__date num">{dayLabel(entry.entry_date)}</span>
        {isWork ? (
          <span className={'entry__type entry__type--work'}>Work</span>
        ) : (
          <span className="entry__type entry__type--off">
            {entry.entry_type === 'vacation' ? 'Vacation' : 'Holiday'}
          </span>
        )}

        {editing ? (
          <div className="entry__edit">
            {isWork && (
              <input
                className="field__input entry__edit-hours"
                type="number"
                min="0"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                aria-label="Hours"
              />
            )}
            <input
              className="field__input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              aria-label="Notes"
            />
          </div>
        ) : (
          <>
            {isWork && <span className="entry__hours num">{fmt(entry.hours_worked)} h</span>}
            {entry.notes && <span className="entry__notes">{entry.notes}</span>}
          </>
        )}
      </div>

      <div className="entry__actions">
        {editing ? (
          <>
            <button className="btn entry__btn" type="button" onClick={save}>
              Save
            </button>
            <button className="btn entry__btn" type="button" onClick={cancel}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn entry__btn" type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="btn entry__btn entry__btn--danger"
              type="button"
              onClick={() => {
                if (window.confirm('Delete this entry?')) onDelete()
              }}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {error && <div className="entry__error">{error}</div>}
    </div>
  )
}
