import { useRef, useState } from 'react';
import { describeDeliveryPreference, formatDeliveryDate, formatWindowTime, MAX_DELIVERY_PREFERENCES } from '../config/shop';
import type { DeliveryWindow } from '../config/shop';

const preferenceNames = ['First choice', 'First backup', 'Second backup'];

export function DeliveryPreferences({ timezone, windows, loading, failed, choices, onChange, onRefresh }: {
  timezone: string; windows: DeliveryWindow[]; loading: boolean; failed: boolean; choices: string[];
  onChange: (choices: string[]) => void; onRefresh: () => void;
}) {
  const [date, setDate] = useState('');
  const [adding, setAdding] = useState(false);
  const dateSelect = useRef<HTMLSelectElement>(null);
  const addBackup = useRef<HTMLButtonElement>(null);
  const selectedList = useRef<HTMLOListElement>(null);
  const available = windows.filter((window) => !choices.includes(window.id) && !choices.includes('day:' + window.date));
  const days = [...new Set(available.map((window) => window.date))];
  const activeDay = days.includes(date) ? date : days[0];
  const dayWindows = windows.filter((window) => window.date === activeDay);
  const hasSpecificWindow = dayWindows.some((window) => choices.includes(window.id));
  const canAdd = days.length > 0 && choices.length < MAX_DELIVERY_PREFERENCES;
  const ready = windows.length > 0 && !loading && !failed;

  function choose(choice: string) {
    onChange([...choices, choice]);
    setAdding(false);
    requestAnimationFrame(() => (addBackup.current ?? selectedList.current)?.focus());
  }

  return <fieldset className="order-preferences">
    <legend>Preferred delivery times <small>(optional)</small></legend>
    <p>Pick a date, then pick a time or choose all-day availability for that date. Times are {timezone === 'America/Chicago' ? 'Central Time' : `local to the shop (${timezone})`}. Your builder will confirm the delivery time with you.</p>
    {loading && <p role="status">Checking available windows…</p>}
    {failed && <p role="status">Delivery times are temporarily unavailable. You can still continue.</p>}
    {!loading && !failed && !windows.length && <p>There are no posted windows right now. Your builder will work out a time with you.</p>}
    {failed && <button type="button" className="text-button" onClick={onRefresh}>Refresh delivery times</button>}
    {choices.length > 0 && <ol className="chosen-windows" ref={selectedList} tabIndex={-1}>
      {choices.map((choice, index) => <li key={choice}>
        <span><strong>{preferenceNames[index]}</strong>{describeDeliveryPreference(choice, windows)}</span>
        <button type="button" className="text-button" aria-label={`Remove ${preferenceNames[index].toLowerCase()}`}
          onClick={() => {
            onChange(choices.filter((value) => value !== choice));
            requestAnimationFrame(() => (addBackup.current ?? dateSelect.current ?? selectedList.current)?.focus());
          }}>Remove</button>
      </li>)}
    </ol>}
    {ready && canAdd && (choices.length === 0 || adding ? <div className="window-picker">
      <label className="delivery-field">{choices.length ? 'Backup date' : 'Preferred date'}
        <select ref={dateSelect} value={activeDay} onChange={(event) => setDate(event.target.value)}>
          {days.map((day) => <option key={day} value={day}>{formatDeliveryDate(day)}</option>)}
        </select>
      </label>
      <div className="window-times" role="group" aria-label={choices.length ? 'Available backup times' : 'Available preferred times'}>
        {dayWindows.map((window) =>
          <button type="button" key={window.id} className="window-choice" disabled={choices.includes(window.id)}
            onClick={() => choose(window.id)}>{formatWindowTime(window)}</button>)}
        {!hasSpecificWindow && <button type="button" className="window-choice" onClick={() => choose('day:' + activeDay)}>
          I’m available all day
        </button>}
      </div>
    </div> : <button type="button" ref={addBackup} className="text-button backup-button" onClick={() => {
      setAdding(true);
      requestAnimationFrame(() => dateSelect.current?.focus());
    }}>Add a backup time or date</button>)}
  </fieldset>;
}
